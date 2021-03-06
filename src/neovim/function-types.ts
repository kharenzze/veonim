export enum BufferVar {
  TermAttached = 'veonim_term_attached',
  TermFormat = 'veonim_term_format',
}

interface VimBuffer {
  name: string,
  cur: boolean,
  mod: boolean,
}

export interface QuickFixList {
  text: string,
  lnum: number,
  col: number,
  vcol?: number,
  pattern?: string,
  nr?: number,
  bufnr?: number,
  filename?: string,
  type?: string,
  valid?: boolean,
}

interface State {
  filetype: string
  cwd: string
  file: string
  colorscheme: string
  revision: number
  bufferType: string
  line: number
  column: number
  editorTopLine: number
  editorBottomLine: number
}

interface Position {
  line: number
  column: number
  editorTopLine: number
  editorBottomLine: number
}

type WindowPosition = [ string, number, number, number ]

export interface Functions {
  VeonimState(): Promise<State>
  VeonimPosition(): Promise<Position>
  VeonimCallEvent(event: string): void
  VeonimCallback(id: number, result: any): void
  Buffers(): Promise<VimBuffer[]>
  OpenPaths(): Promise<string[]>
  getcwd(): Promise<string>
  getline(type: string | number, end?: string): Promise<string | string[]>
  expand(type: string): Promise<string>
  synIDattr(id: number, type: string): Promise<number>
  getpos(where: string): Promise<WindowPosition>
  setloclist(window: number, list: QuickFixList[]): Promise<void>
  getqflist(): Promise<QuickFixList[]>
  cursor(line: number, column: number): Promise<void>
  bufname(expr: string | number): Promise<string>
  getbufline(expr: string | number, startLine: number, endLine?: number | string): Promise<string[]>
  getbufvar(expr: string | number, varname?: string, defaultValue?: any): Promise<any>
  termopen(cmd: string, options: object): void
  jobpid(jobId: number): Promise<number>
  chansend(id: number, data: string | string[]): Promise<number>
  matchadd(hlgrp: string, pattern: string, priority?: number, id?: number): Promise<number>
  matchdelete(id: number): Promise<number>
  getcompletion(pattern: string, type: string): Promise<string[]>
}
