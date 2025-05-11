import * as _Chrono from './chrono'
import { exports as _Inlay } from './inlay'

export const {
  Chrono,
  Inlay: { Root, Token }
} = {
  Chrono: _Chrono,
  Inlay: _Inlay
} as const
