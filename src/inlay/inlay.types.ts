import type { SelectAllState } from './hooks/useSelectionChangeHandler'

export type Token<T> = {
  id: string
  value: T
}

// Add new types for onCharInput
export interface TokenHandle<T> {
  readonly value: T // The actual token value from state at the time of event
  readonly index: number
  readonly text: string // Current text content in the DOM at the time of event
  readonly cursorOffset: number // Current cursor offset within this token's text at the time of event
  readonly isEditable: boolean

  /** Updates the text content of this token. */
  update: (newText: string, newCursorOffset?: number) => void

  /**
   * Splits this token at the current cursor position.
   * The first part of the split will be the text before the cursor.
   * The second part will be based on the provided `textForSecondPart`.
   */
  split: (options: {
    textForSecondPart: string // Raw text for the second part, will be parsed by `actions.parse()`
    spacerChar?: string | null // Explicit spacer to insert after the first part. Undefined = default behavior.
  }) => void

  /**
   * Commits this token's current text and adds a new token after it.
   */
  commit: (options: {
    valueForNewToken: T // Already parsed value for the new token
    spacerChar?: string | null // Explicit spacer to insert after the committed token. Undefined = default behavior.
  }) => void

  /** Removes this token. */
  remove: () => void
}

export type OnInputGlobalActions<T> = {
  /** Signals that the default keydown behavior (including Inlay's own default commit logic) should be prevented. */
  preventDefault: () => void

  /** Parses a string into a token value using the Inlay's configured parser. */
  parse: (text: string) => T | null

  /** Inserts a new token at the specified index. */
  insert: (
    index: number,
    tokenValue: T,
    options?: {
      spacerCharForPrevious?: string | null
      cursorAt?: 'start' | 'end' | { offset: number }
    }
  ) => void

  /** Removes a token at a specific index. */
  removeAt: (index: number) => void

  /** Directly sets all tokens, the cursor position, and optionally spacers. Use with caution. */
  replaceAll: (
    newTokens: T[],
    newCursor: { index: number; offset: number } | null,
    newSpacers?: (string | null)[]
  ) => void

  /**
   * Programmatically focuses the inlay at a specific token and cursor offset.
   * This will move browser focus to the Inlay root (if needed) and schedule
   * the caret to be restored inside the requested token.
   */
  focus: (index: number, offset: number) => void
}

export type OnInputContext<T> = {
  key: string // The e.key value from KeyboardEvent
  tokens: Readonly<T[]> // All current tokens (snapshot from state)
  token: TokenHandle<T> | null // The handle for the active token, if any
  actions: OnInputGlobalActions<T> // Global actions
}
// End of new types

export type InlayContextValue<T> = {
  onTokenChange?: (index: number, value: T) => void
  onTokenFocus?: (index: number | null) => void
  activeTokenRef: React.RefObject<HTMLElement | null>
  tokens: T[]
  updateToken: ({
    index,
    value,
    setActive
  }: {
    index?: number
    value: string
    setActive?: boolean
  }) =>
    | {
        index: number
        token: T
      }
    | undefined
  removeToken: (index: number) => void
  parseToken: (value: string) => T | null
  saveCursor: () => void
  restoreCursor: (
    cursorToRestore?: { index: number; offset: number } | null
  ) => void
  onInput: (e: React.FormEvent<HTMLDivElement>) => void
  spacerChars: (string | null)[]
  displayCommitCharSpacer?:
    | boolean
    | ((commitChar: string, afterTokenIndex: number) => React.ReactNode)
  renderSpacer: (commitChar: string, afterTokenIndex: number) => React.ReactNode
  onCharInput?: (context: OnInputContext<T>) => void // Uses new OnCharInputContext

  // New additions for EditableText integration
  /**
   * Registers or unregisters the string value of an EditableText component.
   * Called by EditableText via useEffect.
   * Pass `null` for text to unregister.
   */
  _registerEditableTextValue: (index: number, text: string | null) => void
  /**
   * Retrieves the registered string value for a token index, if set by an EditableText.
   */
  _getEditableTextValue: (index: number) => string | undefined
} & React.HTMLAttributes<HTMLElement>

export type InlayProps<T> = {
  children: React.ReactNode
  asChild?: boolean
  onTokenChange?: (index: number, value: T) => void
  onChange?: (tokens: T[]) => void
  onFocus?: (index: number | null) => void
  parse: (value: string) => T | null
  value?: T[]
  defaultValue?: T[]
  commitOnChars?: string[]
  defaultNewTokenValue?: T
  addNewTokenOnCommit?: boolean
  insertSpacerOnCommit?: boolean // New prop
  displayCommitCharSpacer?:
    | boolean
    | ((commitChar: string, afterTokenIndex: number) => React.ReactNode)
  onInput?: (context: OnInputContext<T>) => void // Added new prop

  /**
   * Function to derive the display string value from a token.
   * Essential if `T` can be an object and `Inlay.EditableText` is used,
   * or for internal operations needing a string representation of the token.
   */
  getTokenDisplayValue?: (token: T) => string

  /*
   * Controlled caret (cursor) position.
   * If provided, the caret inside the inlay will always try to follow this value.
   * When omitted, the caret is managed internally.
   */
  caret?: CaretPosition

  /**
   * Uncontrolled initial caret position. Ignored when `caret` is supplied.
   */
  defaultCaret?: CaretPosition

  /**
   * Called whenever the caret position changes as a consequence of user interaction.
   */
  onCaretChange?: (caret: CaretPosition) => void

  /**
   * Enables multiline input behavior using Shift+Enter to insert line breaks.
   * Line breaks are represented as special spacers.
   * Defaults to `false`.
   */
  multiline?: boolean
} & Omit<React.HTMLAttributes<HTMLElement>, 'onChange' | 'onFocus' | 'onInput'>

export type InlayTokenProps = {
  index: number
  children: React.ReactNode
  asChild?: boolean
  editable?: boolean
  captureSelectAll?: boolean
}

// Caret (cursor) position type
export type CaretPosition = { index: number; offset: number } | null

// Operation type for history entries
export type InlayOperationType =
  | 'typing'
  | 'paste'
  | 'delete' // General delete
  | 'commit' // Token committed by space/enter, or other commit actions
  | 'token-add' // Explicit token addition (e.g. from a button)
  | 'token-remove' // Explicit token removal
  | 'token-update' // Explicit token update
  | 'root-process' // Change from processing root div text
  | 'unknown' // Default or truly unknown reason

// History entry type for undo/redo
export interface InlayHistoryEntry<T> {
  tokens: Readonly<T[]>
  spacerChars: Readonly<(string | null)[]>
  caretState: Readonly<CaretPosition>
  selectAllState: Readonly<SelectAllState>
  operationType: InlayOperationType // Added operationType
  timestamp: number // Added timestamp for coalescing logic
}
