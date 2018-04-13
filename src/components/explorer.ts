import { getDirFiles, pathRelativeToHome, pathRelativeToCwd, getDirs, $HOME } from '../support/utils'
import { action, current, cmd, call, BufferType } from '../core/neovim'
import { RowNormal, RowImportant } from '../components/row-container'
import { Plugin } from '../components/plugin-container'
import FiletypeIcon from '../components/filetype-icon'
import { join, sep, basename, dirname } from 'path'
import config from '../config/config-service'
import Input from '../components/text-input2'
import { colors } from '../styles/common'
import { filter } from 'fuzzaldrin-plus'
import { h, app } from '../ui/uikit2'

interface FileDir {
  name: string,
  file: boolean,
  dir: boolean,
}

const state = {
  val: '',
  cwd: '',
  path: '',
  paths: [] as FileDir[],
  cache: [] as FileDir[],
  vis: false,
  ix: 0,
  pathMode: false,
  pathValue: '',
}

type S = typeof state

const ignored: { dirs: string[], files: string[] } = {
  dirs: config('explorer.ignore.dirs', m => ignored.dirs = m),
  files: config('explorer.ignore.files', m => ignored.files = m),
}

const sortDirFiles = (filedirs: FileDir[]) => {
  const dirs = filedirs.filter(f => f.dir && !ignored.dirs.includes(f.name))
  const files = filedirs.filter(f => f.file && !ignored.files.includes(f.name))
  return [...dirs, ...files]
}

const absolutePath = (path: string) => path.replace(/^~\//, `${$HOME}/`) 

const pathExplore = async (path: string) => {
  const fullpath = absolutePath(path)
  const complete = fullpath.endsWith('/')
  const dir = complete ? fullpath : dirname(fullpath)
  const top = basename(fullpath)
  const dirs = await getDirs(dir)
  const goodDirs = dirs.filter(d => !ignored.dirs.includes(d.name))
  return complete ? goodDirs : filter(goodDirs, top, { key: 'name' })
}

const resetState = { val: '', path: '', vis: false, ix: 0 }

const actions = {
  // TODO: when choosing custom path and go back, make sure it updates correctly
  // like ~/proj/veonim/ -> OK
  // but  ~/proj/veonim -> DERP!

  ctrlG: () => {
    // TODO: is this still needed in react land?
    // because for whatever reason the 'onupdate' lifecycle event does not
    // get triggered on render pass which includes 'pathMode' value update
    // setTimeout(() => pathInputRef.focus(), 1)
    return { pathMode: true, ix: 0, val: '', pathValue: '' }
  },

  completePath: (s: S) => {
    if (!s.paths.length) return
    const dir = dirname(absolutePath(s.pathValue))
    const { name } = s.paths[s.ix]
    const next = `${join(dir, name)}/`
    pathExplore(next).then(ui.updatePaths)
    return { ix: 0, pathValue: next }
  },

  normalMode: () => ({ pathMode: false }),
  updatePaths: (_: S, paths: string[]) => ({ paths }),

  selectPath: (s: S) => {
    if (!s.pathValue) return { pathMode: false, ix: 0 }
    getDirFiles(s.pathValue).then(paths => ui.updatePaths(sortDirFiles(paths)))
    return { pathMode: false, path: s.pathValue, ix: 0 }
  },

  changePath: (_: S, pathValue: string) => {
    pathExplore(pathValue).then(ui.updatePaths)
    return { pathValue }
  },

  nextPath: (s: S) => {
    const ix = s.ix + 1 >= s.paths.length ? 0 : s.ix + 1
    const fullpath = absolutePath(s.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = s.paths[ix]
    const pathValue = `${join(goodPath, name)}`
    return { ix, pathValue }
  },

  prevPath: (s: S) => {
    const ix = s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1
    const fullpath = absolutePath(s.pathValue)
    const goodPath = fullpath.endsWith('/') ? fullpath : dirname(fullpath)
    const { name } = s.paths[ix]
    const pathValue = `${join(goodPath, name)}`
    return { ix, pathValue }
  },

  select: (s: S) => {
    if (!s.paths.length) return resetState

    const { name, file } = s.paths[s.ix]
    if (!name) return

    if (file) {
      cmd(`e ${pathRelativeToCwd(join(s.path, name), s.cwd)}`)
      return resetState
    }

    const path = join(s.path, name)
    getDirFiles(path).then(paths => ui.show({ path, paths: sortDirFiles(paths) }))
  },

  change: (s: S, val: string) => ({ val, paths: val
    ? sortDirFiles(filter(s.paths, val, { key: 'name' }))
    : s.cache
  }),

  ctrlH: async () => {
    const { cwd } = current
    const filedirs = await getDirFiles(cwd)
    const paths = sortDirFiles(filedirs)
    ui.show({ paths, cwd, path: cwd })
  },

  jumpPrev: (s: S) => {
    const next = s.path.split(sep)
    next.pop()
    const path = join(sep, ...next)
    getDirFiles(path).then(paths => ui.show({ path, paths: sortDirFiles(paths) }))
  },

  show: (s: S, { paths, path, cwd = s.cwd }: any) => ({
    ...resetState,
    cwd,
    path,
    paths,
    vis: true,
    cache: paths,
  }),

  // TODO: be more precise than this? also depends on scaled devices
  down: (s: S) => {
    listElRef.scrollTop += 300
    return { ix: Math.min(s.ix + 17, s.paths.length - 1) }
  },

  up: (s: S) => {
    listElRef.scrollTop -= 300
    return { ix: Math.max(s.ix - 17, 0) }
  },

  top: () => { listElRef.scrollTop = 0 },
  bottom: () => { listElRef.scrollTop = listElRef.scrollHeight },
  hide: () => resetState,
  next: (s: S) => ({ ix: s.ix + 1 >= s.paths.length ? 0 : s.ix + 1 }),
  prev: (s: S) => ({ ix: s.ix - 1 < 0 ? s.paths.length - 1 : s.ix - 1 }),
}

let listElRef: HTMLElement
let pathInputRef: HTMLInputElement

// TODO: reactdom will bind and assume control over it's container element. if
// we try to share this container element with other react components, i
// believe we will be performing a vDOM diff on every single component in the
// #plugins div container element. we should bind to an isolated element so
// that component diffs will not involve any other components
//
// i think we can default a master container element to #plugins, and then
// create a child element #explorer to house the reactdom container element
// binding for the house party with chips and kalamata olive hummus
const element = document.getElementById('plugins') as HTMLElement
const ui = app({ name: 'explorer', element, state, actions, view: ($, a) => Plugin('explorer', $.vis, [

  ,Input({
    value: $.val,
    focus: !$.pathMode,
    // TODO: yo why is this missing??
    // icon: 'hard-drive',
    icon: 'search',
    desc: 'explorer',
    change: a.change,
    hide: a.hide,
    next: a.next,
    prev: a.prev,
    select: a.select,
    jumpPrev: a.jumpPrev,
    down: a.down,
    up: a.up,
    ctrlG: a.ctrlG,
    ctrlH: a.ctrlH,
  })

  ,!$.pathMode && h(RowImportant, [
    ,h('span', pathRelativeToHome($.path))
  ])

  ,$.pathMode && Input({
    change: a.changePath,
    hide: a.normalMode,
    select: a.selectPath,
    tab: a.completePath,
    next: a.nextPath,
    prev: a.prevPath,
    value: pathRelativeToHome($.pathValue),
    background: 'var(--background-50)',
    color: colors.important,
    icon: 'search',
    desc: 'open path',
    small: true,
    focus: true,
    thisIsGarbage: (e: HTMLInputElement) => pathInputRef = e,
    pathMode: true,
  })

  ,h('div', {
    ref: (e: HTMLElement) => listElRef = e,
    style: {
      maxHeight: '50vh',
      overflowY: 'hidden',
    }
  }, $.paths.map(({ name, dir }, ix) => h(RowNormal, {
    key: `${name}-${dir}`,
    active: ix === $.ix,
  }, [
    ,FiletypeIcon(name, { dir })

    ,h('span', { style: { color: dir && ix !== $.ix ? 'var(--foreground-50)' : undefined } }, name)
  ])))

])})

action('explorer', async () => {
  const { cwd, bufferType } = current
  const dirPathOfCurrentFile = await call.expand(`%:p:h`)
  const isTerminal = bufferType === BufferType.Terminal
  const path = isTerminal ? cwd : dirPathOfCurrentFile

  const paths = sortDirFiles(await getDirFiles(path))
  ui.show({ cwd, path, paths })
})
