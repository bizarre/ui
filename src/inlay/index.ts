import { Root, Token, Portal } from './inlay'
import { StructuredInlay } from './structured/structured-inlay'

// Re-export types that consumers may need
export type { InlayProps, InlayRef, TokenState } from './inlay'
export type { Plugin } from './structured/plugins/plugin'
export type { Matcher, Match } from './internal/string-utils'

// Compound component export — use as Inlay.Root, Inlay.Token, Inlay.Portal, etc.
export const Inlay = {
  Root,
  Token,
  Portal,
  StructuredInlay
}
