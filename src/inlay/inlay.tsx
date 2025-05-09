import * as React from 'react'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { Slot } from '@radix-ui/react-slot'
import { ScopedProps } from '../types'

const COMPONENT_NAME = 'Inlay'

const [createInlayContext] = createContextScope(COMPONENT_NAME)

const ZWS = '\u200B'

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
}

export type OnInputContext<T> = {
  key: string // The e.key value from KeyboardEvent
  tokens: Readonly<T[]> // All current tokens (snapshot from state)
  token: TokenHandle<T> | null // The handle for the active token, if any
  actions: OnInputGlobalActions<T> // Global actions
}
// End of new types

type InlayContextValue<T> = {
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
} & React.HTMLAttributes<HTMLElement>

const [InlayProvider, useInlayContext] =
  createInlayContext<InlayContextValue<unknown>>(COMPONENT_NAME)

type InlayProps<T> = {
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
} & Omit<React.HTMLAttributes<HTMLElement>, 'onChange' | 'onFocus' | 'onInput'>

const _Inlay = <T,>(
  {
    children,
    asChild,
    __scope,
    onTokenChange,
    onChange: onTokensChange,
    onFocus: onTokenFocus,
    value: tokensProp,
    defaultValue: defaultTokens,
    parse: parseToken,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit = true,
    insertSpacerOnCommit = true, // Default new prop
    displayCommitCharSpacer = false,
    onInput: onCharInput, // Added new prop
    ...props
  }: ScopedProps<InlayProps<T>>,
  forwardedRef: React.Ref<HTMLElement>
) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const activeTokenRef = React.useRef<HTMLElement | null>(null)
  const domKeyRef = React.useRef(0)
  const prevDomKeyValueRef = React.useRef(domKeyRef.current)
  const selectAllStateRef = React.useRef<'none' | 'token' | 'all'>('none')
  const programmaticCursorExpectationRef = React.useRef<{
    index: number
    offset: number
  } | null>(null)
  const [spacerChars, setSpacerChars] = React.useState<(string | null)[]>([])

  console.log('activeTokenRef', activeTokenRef.current)
  console.log(
    '[_Inlay] Rendering with spacerChars:',
    spacerChars,
    'tokens:',
    tokensProp?.length
  )

  const [tokens, setTokens] = useControllableState({
    prop: tokensProp,
    defaultProp: defaultTokens ?? [],
    onChange: onTokensChange
  })

  console.log(
    '[_Inlay] Rendering. spacerChars:',
    spacerChars,
    'internal tokens length:',
    tokens.length
  )

  // Define renderSpacer function based on the prop
  const renderSpacer = React.useCallback(
    (commitChar: string, afterTokenIndex: number): React.ReactNode => {
      if (typeof displayCommitCharSpacer === 'function') {
        return displayCommitCharSpacer(commitChar, afterTokenIndex)
      }
      if (displayCommitCharSpacer === true) {
        return (
          <span
            contentEditable="false"
            suppressContentEditableWarning
            style={{ whiteSpace: 'pre' }}
          >
            {commitChar}
          </span>
        )
      }
      return null // If displayCommitCharSpacer is false or undefined
    },
    [displayCommitCharSpacer]
  )

  // Effect to keep spacerCharsListRef in sync with tokens length
  React.useEffect(() => {
    // Only resize/initialize if the lengths are out of sync.
    // This prevents overwriting intentionally set spacers when tokens.length changes
    // but spacerChars was already updated by an operation like handleKeyDown.
    if (spacerChars.length !== tokens.length) {
      setSpacerChars(Array(tokens.length).fill(null))
    }
  }, [tokens.length, spacerChars.length]) // Re-run if the number of tokens changes OR spacerChars length changes

  const savedCursorRef = React.useRef<{
    index: number
    offset: number
  } | null>(null)

  React.useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      const expectation = programmaticCursorExpectationRef.current

      // Check if focus is still within the Inlay at all.
      // If not, clear all internal state related to active token/cursor and bail.
      if (
        !ref.current ||
        (document.activeElement &&
          !ref.current.contains(document.activeElement) &&
          document.activeElement !== ref.current)
      ) {
        console.log(
          '[selectionchange] Focus is OUTSIDE Inlay or Inlay unmounted. Clearing state.'
        )
        if (activeTokenRef.current) {
          activeTokenRef.current = null
          // Only call onTokenFocus if it was previously focused, to avoid unnecessary calls
          // if (savedCursorRef.current !== null || selectAllStateRef.current !== 'none') { // Heuristic
          onTokenFocus?.(null)
          // }
        }
        if (savedCursorRef.current) {
          savedCursorRef.current = null
        }
        if (programmaticCursorExpectationRef.current) {
          programmaticCursorExpectationRef.current = null
        }
        if (selectAllStateRef.current !== 'none') {
          console.log(
            '[selectionchange] Focus outside, resetting selectAllStateRef to none.'
          )
          selectAllStateRef.current = 'none'
        }
        return
      }

      if (!sel || sel.rangeCount === 0) {
        // This case implies selection is lost, possibly within the component but no specific range (e.g. focus on main div with no specific selection)
        // Or, it could be that focus truly left but the above check didn't catch it (e.g. if ref.current became null concurrently)
        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        }
        // If focus is lost or selection is empty, any pending expectation is moot.
        if (expectation) {
          console.log(
            '[selectionchange] Null/Empty selection, clearing expectation:',
            expectation
          )
          programmaticCursorExpectationRef.current = null
        }
        // Do not clear savedCursorRef here unconditionally, as focus might still be on the main div
        // and useLayoutEffect might need savedCursorRef if it's about to restore to a token.
        // The top check for focus OUTSIDE tokenbox is more definitive for clearing savedCursorRef.
        if (selectAllStateRef.current !== 'none') {
          console.log(
            '[selectionchange] Null/Empty selection, resetting selectAllStateRef to none.'
          )
          selectAllStateRef.current = 'none'
        }
        return
      }

      const range = sel.getRangeAt(0)
      const container = range.startContainer

      const tokenEl =
        container.nodeType === Node.TEXT_NODE
          ? (container.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)
          : (container as HTMLElement)

      // If selection moves outside the Inlay editor completely
      if (tokenEl && ref.current && !ref.current.contains(tokenEl)) {
        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          savedCursorRef.current = null
          onTokenFocus?.(null)
          if (selectAllStateRef.current !== 'none') {
            console.log(
              '[selectionchange] Focus moved outside tokenbox, resetting selectAllStateRef to none.'
            )
            selectAllStateRef.current = 'none'
          }
        }
        if (expectation) {
          console.log(
            '[selectionchange] Focus moved outside tokenbox, clearing expectation:',
            expectation
          )
          programmaticCursorExpectationRef.current = null
        }
        return
      }

      console.log(
        '[selectionchange] type:',
        tokenEl?.dataset.tokenId,
        'container nodeType:',
        container.nodeType,
        'expectation:',
        expectation
      )

      if (tokenEl && tokenEl.hasAttribute('data-token-id')) {
        const tokenIdStr = tokenEl.getAttribute('data-token-id')!
        const newActiveIndex = parseInt(tokenIdStr)
        let finalOffset: number
        const tokenTextContent = tokenEl.textContent || ''

        // Determine finalOffset based on selection (same logic as before)
        if (
          tokenTextContent === ZWS &&
          tokenEl.getAttribute('data-token-editable') === 'true'
        ) {
          finalOffset = 0
        } else if (
          container.nodeType === Node.TEXT_NODE &&
          tokenEl.contains(container)
        ) {
          finalOffset = range.startOffset
        } else if (container === tokenEl) {
          finalOffset = tokenTextContent.length
        } else {
          // Fallback, e.g. if selection is on a child element within the token span that isn't a text node
          finalOffset = tokenTextContent.length
        }

        // Log current state before expectation logic
        console.log(
          '[selectionchange] Token selected. ID:',
          newActiveIndex,
          'DOM Offset:',
          finalOffset,
          'Current savedCursor:',
          savedCursorRef.current,
          'Current expectation:',
          expectation
        )

        if (expectation && expectation.index === newActiveIndex) {
          // We have an expectation for THIS token
          if (expectation.offset === finalOffset) {
            // DOM matches our expectation!
            console.log(
              '[selectionchange] Expectation MET for token',
              newActiveIndex,
              'at offset',
              finalOffset
            )
            if (
              savedCursorRef.current?.index !== newActiveIndex ||
              savedCursorRef.current?.offset !== finalOffset
            ) {
              savedCursorRef.current = {
                index: newActiveIndex,
                offset: finalOffset
              }
            }
            programmaticCursorExpectationRef.current = null // Expectation fulfilled
          } else {
            // DOM does NOT match expectation for this token
            console.warn(
              '[selectionchange] Expectation MISMATCH for token',
              newActiveIndex,
              '. Expected offset:',
              expectation.offset,
              'Actual DOM offset:',
              finalOffset,
              'Not updating savedCursor. Letting useLayoutEffect reconcile.'
            )
            // DO NOT update savedCursorRef.current with the mismatched DOM offset.
            // DO NOT clear programmaticCursorExpectationRef.current yet.
            // Let useLayoutEffect try to enforce the original expectation or a new one from savedCursorRef.
            return // Stop processing this selectionchange event further for this path
          }
        } else {
          // No expectation for THIS token (either null, or for a different token ID)
          if (expectation) {
            // Implies expectation was for a *different* token ID
            console.log(
              '[selectionchange] Expectation existed for token ID',
              expectation.index,
              '(offset:',
              expectation.offset,
              ')',
              'but current selection is on token ID',
              newActiveIndex,
              '(DOM offset:',
              finalOffset,
              '). Ignoring this selectionchange event and letting useLayoutEffect attempt to fulfill the original expectation.'
            )
            // DO NOT clear programmaticCursorExpectationRef.current.
            // DO NOT update savedCursorRef.current.
            return // Let useLayoutEffect try to handle the pending expectation.
          }

          // Logic for when there's no relevant pending expectation for the current selection's token
          // (This part is reached if expectation was null, or if it was for a different token AND we didn't return above)
          // ^ The above comment is now slightly inaccurate due to the return, but the core idea is:
          // If we are here, it means either:
          //    1. `expectation` was null initially.
          //    2. `expectation` was for a different token, and the new logic decided to proceed (which it currently doesn't, it returns).
          // For safety and current flow, this path means `expectation` was null.
          const currentSaved = savedCursorRef.current
          if (!currentSaved || currentSaved.index !== newActiveIndex) {
            // Selection moved to a NEW token, or from no token to a token. Update savedCursor fully.
            console.log(
              '[selectionchange] No/Diff Expectation: Selection on new/different token or from null. Updating savedCursor. From:',
              currentSaved,
              'To:',
              { index: newActiveIndex, offset: finalOffset }
            )
            savedCursorRef.current = {
              index: newActiveIndex,
              offset: finalOffset
            }
          } else {
            // Selection is on the SAME token index as savedCursorRef, and no expectation was pending for it.
            // This implies useLayoutEffect might have just set cursor, or user clicked within the same token.
            // DO NOT change savedCursorRef.current.offset based on this event's finalOffset from DOM.
            // Trust the offset that's already in savedCursorRef.current (set programmatically).
            console.log(
              '[selectionchange] No/Diff Expectation: Selection on same token index',
              newActiveIndex,
              '. savedCursor.offset:',
              currentSaved.offset,
              'DOM reports offset:',
              finalOffset,
              '. NOT updating savedCursor.offset.'
            )
            // However, ensure savedCursorRef is not null if a token is selected.
            if (
              savedCursorRef.current === null &&
              typeof newActiveIndex === 'number'
            ) {
              // Should not happen if currentSaved.index === newActiveIndex, but as a safeguard
              console.warn(
                '[selectionchange] savedCursor was null but selection is on same token index. This is unexpected. Setting savedCursor offset to DOM offset as a fallback.'
              )
              savedCursorRef.current = {
                index: newActiveIndex,
                offset: finalOffset
              }
            }
          }
        }

        // Update activeTokenRef and call onTokenFocus if it changed
        const oldActiveToken = activeTokenRef.current
        if (oldActiveToken !== tokenEl) {
          activeTokenRef.current = tokenEl
          onTokenFocus?.(newActiveIndex)
          if (selectAllStateRef.current === 'token') {
            console.log(
              '[selectionchange] Active token changed, resetting selectAllStateRef from token to none.'
            )
            selectAllStateRef.current = 'none'
          }
        }
      } else {
        // Selection is not on a token (e.g., in the root div between tokens, or completely outside)
        console.log('[selectionchange] Selection not on a token.')
        if (expectation) {
          console.log(
            '[selectionchange] Selection not on token, clearing expectation for token',
            expectation.index,
            expectation
          )
          programmaticCursorExpectationRef.current = null
        }

        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
          if (selectAllStateRef.current === 'token') {
            console.log(
              '[selectionchange] Selection no longer on a token, resetting selectAllStateRef from token to none.'
            )
            selectAllStateRef.current = 'none'
          }
        }
        // If focus is still within the main Inlay div but not on a token
        if (
          ref.current &&
          document.activeElement &&
          ref.current.contains(document.activeElement)
        ) {
          // Only set savedCursor to null if it's not already null
          if (savedCursorRef.current !== null) {
            console.log(
              '[selectionchange] Selection in root. Clearing savedCursor.'
            )
            savedCursorRef.current = null
          }
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [onTokenFocus, ref]) // Added ref to dependencies, as it's used. Consider if parseToken is needed if expectation logic changes things.

  const saveCursor = React.useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      savedCursorRef.current = null
      return
    }

    const range = sel.getRangeAt(0)
    const container = range.startContainer
    const offset = range.startOffset

    const tokenEl =
      container.nodeType === Node.ELEMENT_NODE &&
      (container as Element).hasAttribute?.('data-token-id')
        ? (container as HTMLElement)
        : (container.parentElement?.closest(
            '[data-token-id]'
          ) as HTMLElement | null)

    console.log(
      '[saveCursor] Found tokenEl:',
      tokenEl?.dataset?.tokenId,
      'container:',
      container,
      'offset:',
      offset
    )

    if (tokenEl) {
      const tokenId = tokenEl.getAttribute('data-token-id')
      if (tokenId) {
        let relativeOffset = offset
        if (container === tokenEl) {
          relativeOffset = tokenEl.textContent?.length ?? 0
        }
        savedCursorRef.current = {
          index: parseInt(tokenId),
          offset: relativeOffset
        }
        return
      }
    }
    savedCursorRef.current = null
  }, [])

  const restoreCursor = React.useCallback(
    (cursorToRestore?: { index: number; offset: number } | null) => {
      const sel = window.getSelection()
      if (!sel || !ref.current) return

      const saved = cursorToRestore || savedCursorRef.current
      if (!saved) return

      const element = ref.current.querySelector(
        `[data-token-id="${saved.index}"]`
      ) as HTMLElement | null
      if (!element) return

      const range = document.createRange()
      const textContent = element.textContent || ''

      if (textContent === '' && saved.offset === 0) {
        range.selectNodeContents(element)
        range.collapse(true)
      } else {
        const firstChild = element.firstChild
        if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) {
          range.selectNodeContents(element)
          range.collapse(true)
          console.warn(
            'Inlay: restoreCursor trying to set offset in a non-text node or empty token without a text node. Collapsing to start of token.'
          )
        } else {
          const textNode = firstChild
          const textLength = textNode.textContent?.length ?? 0
          const safeOffset = Math.min(saved.offset, textLength)

          range.setStart(textNode, safeOffset)
          range.collapse(true)
        }
      }

      sel.removeAllRanges()
      sel.addRange(range)
      if (sel.rangeCount > 0) {
        const currentRange = sel.getRangeAt(0)
        console.log(
          '[restoreCursor] After addRange. DOM sel offset:',
          currentRange.startOffset,
          'DOM sel container text:',
          JSON.stringify(currentRange.commonAncestorContainer.textContent),
          'Expected offset:',
          saved?.offset
        )
      }
    },
    [ref]
  )

  const onInput = React.useCallback(() => {
    const currentSelectionForLog = window.getSelection()
    console.log(
      '[onInput PRE-START] Raw document.activeElement:',
      document.activeElement,
      'activeTokenRef.current:',
      activeTokenRef.current?.dataset.tokenId
    )
    console.log(
      '[onInput START] Before any processing:',
      'activeElement:',
      document.activeElement === ref.current
        ? 'main_div'
        : document.activeElement === document.body
          ? 'body'
          : document.activeElement?.getAttribute('data-token-id') ||
            document.activeElement,
      'selection:',
      currentSelectionForLog && currentSelectionForLog.rangeCount > 0
        ? {
            anchorNodeValue: currentSelectionForLog.anchorNode?.nodeValue,
            anchorOffset: currentSelectionForLog.anchorOffset,
            isCollapsed: currentSelectionForLog.isCollapsed,
            type: currentSelectionForLog.type
            // Consider adding focusNode, focusOffset if needed for more complex selection debugging
          }
        : 'No selection'
    )

    let initiallySelectedTokenElementForRAF: HTMLElement | null = null
    const currentSelection = window.getSelection()
    if (currentSelection && currentSelection.rangeCount > 0) {
      const range = currentSelection.getRangeAt(0)
      const container = range.startContainer
      const parentElement =
        container.nodeType === Node.ELEMENT_NODE
          ? (container as HTMLElement)
          : container.parentElement
      if (parentElement) {
        initiallySelectedTokenElementForRAF =
          parentElement.closest('[data-token-id]')
      }
    }
    saveCursor()

    requestAnimationFrame(() => {
      let elementToProcess = initiallySelectedTokenElementForRAF

      // Prioritize activeTokenRef.current if it seems valid and differs from selection-based one,
      // especially if the main div is the document.activeElement, indicating selection might be less reliable.
      if (
        activeTokenRef.current &&
        ref.current &&
        ref.current.contains(activeTokenRef.current) &&
        document.activeElement === ref.current
      ) {
        if (elementToProcess !== activeTokenRef.current) {
          console.log(
            '[onInput rAF] Overriding elementToProcess. Was:',
            elementToProcess?.dataset.tokenId,
            'Now (from activeTokenRef):',
            activeTokenRef.current.dataset.tokenId
          )
          elementToProcess = activeTokenRef.current
        }
      }

      console.log(
        '[onInput rAF] Started. Actual processing target (from post-input selection):',
        elementToProcess?.dataset?.tokenId,
        'Current activeTokenRef (from selectionchange event):',
        activeTokenRef.current?.dataset?.tokenId
      )

      let newTokensToSet: T[] | null = null

      if (elementToProcess && elementToProcess.hasAttribute('data-token-id')) {
        const activeTokenId = elementToProcess.getAttribute('data-token-id')!
        const activeIndex = parseInt(activeTokenId)
        const rawDomTextContent = elementToProcess.textContent || ''
        const textToParse = rawDomTextContent === ZWS ? '' : rawDomTextContent
        console.log(
          '[onInput rAF] Processing active element. TokenId:',
          activeTokenId,
          'RawText:',
          JSON.stringify(rawDomTextContent),
          'ParsedText:',
          JSON.stringify(textToParse)
        )
        const newActiveTokenValue = parseToken(textToParse)

        if (newActiveTokenValue !== null) {
          if (
            activeIndex < tokens.length &&
            JSON.stringify(tokens[activeIndex]) !==
              JSON.stringify(newActiveTokenValue)
          ) {
            const newTokens = [...tokens]
            newTokens[activeIndex] = newActiveTokenValue
            newTokensToSet = newTokens
          } else if (activeIndex >= tokens.length && newActiveTokenValue) {
            console.warn(
              '[onInput rAF] Active element index out of bounds, but value exists. This case needs review.'
            )
            if (tokens.length === 0 && activeIndex === 0) {
              newTokensToSet = [newActiveTokenValue]
            }
          }
        } else {
          if (activeIndex < tokens.length) {
            const tempTokens = tokens.filter((_, idx) => idx !== activeIndex)
            if (JSON.stringify(tempTokens) !== JSON.stringify(tokens)) {
              newTokensToSet = tempTokens
              if (newTokensToSet.length > 0) {
                if (activeIndex >= newTokensToSet.length) {
                  savedCursorRef.current = {
                    index: newTokensToSet.length - 1,
                    offset: String(
                      newTokensToSet[newTokensToSet.length - 1] ?? ''
                    ).length
                  }
                } else {
                  savedCursorRef.current = { index: activeIndex, offset: 0 }
                }
              } else {
                savedCursorRef.current = null
              }
            }
          }
        }
      } else {
        const wholeText = ref.current?.textContent || ''
        const textToParseForRoot = wholeText === ZWS ? '' : wholeText
        console.log(
          '[onInput rAF] No active elementToProcess or not a data token. Processing root. RawRootText:',
          JSON.stringify(wholeText),
          'ParsedRootText:',
          JSON.stringify(textToParseForRoot)
        )
        newTokensToSet = processRootText(
          textToParseForRoot,
          tokens,
          parseToken,
          savedCursorRef
        )
      }

      console.log(
        '[onInput rAF] Determined newTokensToSet:',
        newTokensToSet ? JSON.parse(JSON.stringify(newTokensToSet)) : null,
        'Current tokens state was:',
        JSON.parse(JSON.stringify(tokens))
      )
      if (newTokensToSet !== null) {
        setTokens(newTokensToSet)
      }
    })
  }, [tokens, parseToken, setTokens, saveCursor, ref])

  function processRootText<T>(
    wholeTextToParse: string,
    currentTokens: Readonly<T[]>,
    parseTokenFunc: (value: string) => T | null,
    savedCursorRefForUpdate: React.MutableRefObject<any>
  ): T[] | null {
    if (wholeTextToParse.trim() === '') {
      if (currentTokens.length === 0) return null
      savedCursorRefForUpdate.current = null
      return []
    } else {
      const parsedFallbackToken = parseTokenFunc(wholeTextToParse)
      if (parsedFallbackToken !== null) {
        if (
          currentTokens.length === 1 &&
          JSON.stringify(currentTokens[0]) ===
            JSON.stringify(parsedFallbackToken)
        )
          return null
        if (!savedCursorRefForUpdate.current) {
          savedCursorRefForUpdate.current = {
            index: 0,
            offset: wholeTextToParse.length
          }
        }
        return [parsedFallbackToken]
      } else {
        if (currentTokens.length === 0) return null
        savedCursorRefForUpdate.current = null
        return []
      }
    }
  }

  const handleRemoveTokenOnKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    selectAllState: 'none' | 'token' | 'all'
  ) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return

    const currentSelection = window.getSelection()
    if (!currentSelection || currentSelection.rangeCount === 0) return

    // Initial log for entry and basic state
    const rangeForLog = currentSelection.getRangeAt(0)
    const localActiveTokenForLog = activeTokenRef.current
    const activeIndexForLog = localActiveTokenForLog
      ? parseInt(localActiveTokenForLog.getAttribute('data-token-id')!)
      : null
    const currentTextForLog = localActiveTokenForLog
      ? localActiveTokenForLog.textContent === ZWS
        ? ''
        : localActiveTokenForLog.textContent || ''
      : ''
    console.log(
      `[handleRemoveTokenOnKeyDown ENTRY] key: ${e.key}, selectAllState: ${selectAllState}, activeIndex: ${activeIndexForLog}, startOffset: ${rangeForLog.startOffset}, currentTextLength: ${currentTextForLog.length}, currentText: "${currentTextForLog}"`
    )

    if (selectAllState === 'token') {
      const localActiveToken = activeTokenRef.current
      if (
        localActiveToken &&
        localActiveToken.getAttribute('data-token-editable') === 'true'
      ) {
        e.preventDefault()
        const activeTokenIdStr = localActiveToken.getAttribute('data-token-id')
        if (!activeTokenIdStr) return
        const activeIndex = parseInt(activeTokenIdStr)

        console.log(
          '[handleRemoveTokenOnKeyDown] selectAllState=token: Clearing content of token',
          activeIndex
        )

        const newTokenValue = parseToken('') // Attempt to get an "empty" token value
        if (newTokenValue !== null) {
          setTokens((prevTokens) => {
            const updatedTokens = [...prevTokens]
            updatedTokens[activeIndex] = newTokenValue
            return updatedTokens
          })
          savedCursorRef.current = { index: activeIndex, offset: 0 } // Cursor at start of now-empty token
        } else {
          // Token became invalid/empty, remove it
          removeToken(activeIndex) // removeToken handles domKey and cursor
        }
        // selectAllStateRef is reset by the caller (onKeyDown) after this returns with e.defaultPrevented
        return
      }
    } else if (selectAllState === 'all') {
      e.preventDefault()
      console.log(
        '[handleRemoveTokenOnKeyDown] selectAllState=all: Clearing all tokens'
      )
      setTokens([])
      if (activeTokenRef.current !== null) {
        activeTokenRef.current = null
        onTokenFocus?.(null)
      }
      savedCursorRef.current = null
      // selectAllStateRef is reset by the caller (onKeyDown) after this returns with e.defaultPrevented
      return
    }

    const range = currentSelection.getRangeAt(0)
    const { startContainer, startOffset, endOffset } = range
    const isCollapsed = range.collapsed

    const localActiveToken = activeTokenRef.current

    if (
      localActiveToken &&
      localActiveToken.getAttribute('data-token-editable') === 'true' &&
      localActiveToken.contains(startContainer)
    ) {
      const activeTokenIdStr = localActiveToken.getAttribute('data-token-id')
      if (!activeTokenIdStr) return
      const activeIndex = parseInt(activeTokenIdStr)
      const currentText =
        localActiveToken.textContent === ZWS
          ? ''
          : localActiveToken.textContent || '' // Use ZWS logic
      const textNode = localActiveToken.firstChild

      // Ensure we are operating on the text node directly or a selection that starts/ends within it.
      if (
        textNode &&
        textNode.nodeType === Node.TEXT_NODE &&
        (startContainer === textNode || startContainer === localActiveToken)
      ) {
        let newText = currentText
        let newCursorOffset = startOffset

        if (isCollapsed) {
          // Single character deletion
          if (e.key === 'Backspace') {
            if (startOffset === 0) {
              // Backspace at the beginning of an editable token.
              if (activeIndex > 0) {
                // There's a previous token to merge with
                e.preventDefault() // We are handling this merge.

                const prevTokenIndex = activeIndex - 1
                // Ensure tokens array is accessed correctly from component scope
                const prevTokenValue = tokens[prevTokenIndex]
                const currentTokenValue = tokens[activeIndex]

                // Treat ZWS as empty for merge purposes, otherwise use stringified value
                const prevTokenTextForMerge = String(
                  prevTokenValue === ZWS ? '' : (prevTokenValue ?? '')
                )
                const currentTokenTextForMerge = String(
                  currentTokenValue === ZWS ? '' : (currentTokenValue ?? '')
                )

                const mergedText =
                  prevTokenTextForMerge + currentTokenTextForMerge
                const newParsedMergedToken = parseToken(mergedText) // Use component's parseToken

                if (newParsedMergedToken !== null) {
                  const newTokensState = [...tokens]
                  newTokensState[prevTokenIndex] = newParsedMergedToken // Update previous token
                  newTokensState.splice(activeIndex, 1) // Remove current token

                  // Remove the spacer that was after the prevToken (between prev and current)
                  const newSpacerCharsState = [...spacerChars]
                  newSpacerCharsState.splice(prevTokenIndex, 1)

                  setTokens(newTokensState)
                  setSpacerChars(newSpacerCharsState)

                  savedCursorRef.current = {
                    index: prevTokenIndex,
                    offset: prevTokenTextForMerge.length
                  }
                  programmaticCursorExpectationRef.current =
                    savedCursorRef.current
                  // selectAllStateRef.current = 'none'; // Consider if selectAllState needs reset
                  return // Merge handled
                } else {
                  // Merge failed (e.g., parseToken returned null for merged content)
                  console.warn(
                    '[handleRemoveTokenOnKeyDown] Merge attempt failed: parseToken returned null for merged text. No action taken.'
                  )
                  // Event is already prevented. Return to avoid falling through to other deletion logic.
                  return
                }
              } else {
                // Backspace at the start of the *first* token.
                // Let this fall through to existing boundary logic or native handling if not further handled.
                // The defaultPrevented check later will determine if it proceeds.
                // For now, this path doesn't call e.preventDefault() itself.
              }
            } else {
              // Intra-token backspace (not at startOffset 0)
              e.preventDefault()
              newText =
                currentText.slice(0, startOffset - 1) +
                currentText.slice(startOffset)
              newCursorOffset = startOffset - 1
            }
          } else if (e.key === 'Delete') {
            console.log(
              `[handleRemoveTokenOnKeyDown] Delete key pressed. activeIndex: ${activeIndex}, startOffset: ${startOffset}, currentText.length: ${currentText.length}`
            )
            if (startOffset === currentText.length) {
              console.log(
                `[handleRemoveTokenOnKeyDown] Delete at end of token. activeIndex: ${activeIndex}, tokens.length: ${tokens.length}`
              )
              // Delete at the end of an editable token - potentially merge with next token.
              if (activeIndex < tokens.length - 1) {
                // There's a next token to merge with
                console.log(
                  `[handleRemoveTokenOnKeyDown] Attempting merge with next. Prev token: "${tokens[activeIndex]}", Next token: "${tokens[activeIndex + 1]}"`
                )
                e.preventDefault() // We are handling this merge.

                const nextTokenIndex = activeIndex + 1
                const currentTokenValue = tokens[activeIndex]
                const nextTokenValue = tokens[nextTokenIndex]

                // Treat ZWS as empty for merge purposes, otherwise use stringified value
                const currentTokenTextForMerge = String(
                  currentTokenValue === ZWS ? '' : (currentTokenValue ?? '')
                )
                const nextTokenTextForMerge = String(
                  nextTokenValue === ZWS ? '' : (nextTokenValue ?? '')
                )

                const mergedText =
                  currentTokenTextForMerge + nextTokenTextForMerge
                const newParsedMergedToken = parseToken(mergedText) // Use component's parseToken

                if (newParsedMergedToken !== null) {
                  const newTokensState = [...tokens]
                  newTokensState[activeIndex] = newParsedMergedToken // Update current token
                  newTokensState.splice(nextTokenIndex, 1) // Remove next token

                  // Remove the spacer that was after the currentToken (between current and next)
                  const newSpacerCharsState = [...spacerChars]
                  // The spacer to remove is the one at currentToken's original index
                  newSpacerCharsState.splice(activeIndex, 1)

                  setTokens(newTokensState)
                  setSpacerChars(newSpacerCharsState)

                  savedCursorRef.current = {
                    index: activeIndex,
                    offset: currentTokenTextForMerge.length // Cursor at end of original current token part
                  }
                  programmaticCursorExpectationRef.current =
                    savedCursorRef.current
                  return // Merge handled
                } else {
                  // Merge failed
                  console.warn(
                    '[handleRemoveTokenOnKeyDown] Merge attempt (Delete) failed: parseToken returned null for merged text. No action taken.'
                  )
                  return // Event is already prevented.
                }
              } else {
                // Delete at the end of the *last* token.
                // Let this fall through to existing boundary logic or native handling.
              }
            } else {
              // Intra-token delete
              e.preventDefault()
              newText =
                currentText.slice(0, startOffset) +
                currentText.slice(startOffset + 1)
              newCursorOffset = startOffset
            }
          }
        } else {
          // Range deletion
          e.preventDefault()
          newText =
            currentText.slice(0, startOffset) + currentText.slice(endOffset)
          newCursorOffset = startOffset
        }

        if (e.defaultPrevented) {
          // If we handled it (i.e., an intra-token change or a successful merge that called preventDefault)
          const newTokenValue = parseToken(newText)
          if (newTokenValue !== null) {
            setTokens((prevTokens) => {
              const updatedTokens = [...prevTokens]
              updatedTokens[activeIndex] = newTokenValue
              return updatedTokens
            })
            savedCursorRef.current = {
              index: activeIndex,
              offset: newCursorOffset
            }
          } else {
            // Token became invalid/empty after deletion, remove it
            removeToken(activeIndex) // removeToken handles domKey and cursor for token removal
          }
          return // Handled, so exit early
        }
      }
    }

    // Existing logic for non-editable tokens or boundary conditions for editable ones:
    if (
      localActiveToken &&
      localActiveToken.getAttribute('data-token-editable') === 'false'
    ) {
      console.log(
        'handleRemoveTokenOnKeyDown: non-editable token deletion',
        localActiveToken.dataset.tokenId
      )
      e.preventDefault()
      // The requestAnimationFrame here might be problematic, consider direct removal
      // requestAnimationFrame(() => {
      saveCursor() // Save cursor might be tricky here as element is about to be removed
      if (activeTokenRef.current) {
        // re-check activeTokenRef as it might have changed
        const tokenIndexToRemove = parseInt(
          activeTokenRef.current.getAttribute('data-token-id')!
        )
        removeToken(tokenIndexToRemove)
      }
      // });
      return
    }

    console.log(
      'handleRemoveTokenOnKeyDown key:',
      e.key,
      'Falling through to boundary/merge logic or native handling'
    )

    let tokenElToRemove: HTMLElement | null = null
    // Determine if we are at a boundary to remove a whole token element
    // This logic might need refinement based on activeTokenRef vs. selection's container

    if (e.key === 'Backspace') {
      if (startOffset === 0) {
        // If cursor is at the start of the active token (or its text node)
        if (
          localActiveToken &&
          (startContainer === localActiveToken ||
            startContainer.parentElement === localActiveToken)
        ) {
          tokenElToRemove = localActiveToken
        } else {
          // Try to find previous sibling if selection is not directly on active token but at start of some node
          const currentElement =
            startContainer.nodeType === Node.TEXT_NODE
              ? startContainer.parentElement
              : (startContainer as Element)
          const prevSibling = currentElement?.previousElementSibling
          if (prevSibling && prevSibling.hasAttribute('data-token-id')) {
            tokenElToRemove = prevSibling as HTMLElement
          }
        }
      }
    }

    if (e.key === 'Delete') {
      if (
        localActiveToken &&
        (startContainer === localActiveToken ||
          startContainer.parentElement === localActiveToken)
      ) {
        const textLen = localActiveToken.textContent?.length ?? 0
        if (startOffset === textLen) {
          // Cursor at the end
          const nextSibling = localActiveToken.nextElementSibling
          if (nextSibling && nextSibling.hasAttribute('data-token-id')) {
            tokenElToRemove = nextSibling as HTMLElement
          }
        }
      } else if (startContainer.nodeType === Node.TEXT_NODE) {
        const textLen = startContainer.textContent?.length ?? 0
        if (startOffset === textLen) {
          const parentElement = startContainer.parentElement?.closest(
            '[data-token-id]'
          ) as HTMLElement | null
          const nextSibling = parentElement?.nextElementSibling
          if (nextSibling && nextSibling.hasAttribute('data-token-id')) {
            tokenElToRemove = nextSibling as HTMLElement
          }
        }
      }
    }

    if (tokenElToRemove) {
      console.log(
        'handleRemoveTokenOnKeyDown: GOING TO TRY TO REMOVE (boundary)',
        tokenElToRemove.getAttribute('data-token-id')
      )
      const tokenId = tokenElToRemove.getAttribute('data-token-id')
      if (tokenId) {
        e.preventDefault()
        // Potentially merge text if the token being removed is adjacent to another editable token
        // For now, just remove it. //This comment is from original code, merge is now handled above for backspace.
        removeToken(parseInt(tokenId))
      }
      return
    }
  }

  const updateToken = React.useCallback(
    ({
      index,
      value,
      setActive
    }: {
      index: number
      value: string
      setActive?: boolean
    }) => {
      const newToken = parseToken(value)
      if (!newToken) return

      if (setActive) {
        savedCursorRef.current = { index, offset: (value || '').length }
      }

      setTokens((prev) => {
        const newTokens = [...prev]
        if (index >= 0 && index < newTokens.length) {
          newTokens[index] = newToken
        }
        return newTokens
      })

      return { index, token: newToken }
    },
    [parseToken, setTokens]
  )

  const removeToken = React.useCallback(
    (index: number) => {
      console.log('removeToken', index)

      const currentActiveTokenId =
        activeTokenRef.current?.getAttribute('data-token-id')
      let nextCursorIndex: number | null = null
      let nextCursorOffset = 0

      if (
        currentActiveTokenId === index.toString() ||
        (tokens.length === 1 && index === 0)
      ) {
        activeTokenRef.current = null
        onTokenFocus?.(null)

        if (tokens.length > 1) {
          if (index > 0) {
            nextCursorIndex = index - 1
            const prevTokenValue = tokens[nextCursorIndex]
            nextCursorOffset = String(prevTokenValue ?? '').length
          } else {
            nextCursorIndex = 0 // Was 0, should remain 0 if first token is removed and others exist
            nextCursorOffset = 0
          }
        } else {
          nextCursorIndex = null
        }
      }

      setTokens((prev) => {
        if (index < 0 || index >= prev.length) return prev
        const newTokens = prev.filter((_, i) => i !== index)

        // Update spacerCharsListRef as well
        const newSpacerCharsList = spacerChars.filter((_, i) => i !== index)
        setSpacerChars(newSpacerCharsList)

        if (
          nextCursorIndex !== null &&
          newTokens.length > 0 &&
          nextCursorIndex < newTokens.length
        ) {
          savedCursorRef.current = {
            index: nextCursorIndex,
            offset: nextCursorOffset
          }
        } else if (newTokens.length === 0) {
          savedCursorRef.current = null
        } else if (
          newTokens.length > 0 &&
          (nextCursorIndex === null || nextCursorIndex >= newTokens.length)
        ) {
          savedCursorRef.current = {
            index: newTokens.length - 1,
            offset: String(newTokens[newTokens.length - 1] ?? '').length
          }
        }

        if (JSON.stringify(newTokens) !== JSON.stringify(prev)) {
          // domKeyRef.current += 1 // INTENTIONALLY REMOVED
        }
        return newTokens
      })
    },
    [tokens, onTokenFocus, setTokens, spacerChars, setSpacerChars]
  )

  React.useLayoutEffect(() => {
    const currentDomKey = domKeyRef.current
    const domWasReKeyed = prevDomKeyValueRef.current !== currentDomKey

    console.log(
      `[useLayoutEffect #${currentDomKey}] START. domWasReKeyed: ${domWasReKeyed}`,
      'savedCursorRef:',
      savedCursorRef.current,
      'activeTokenRef:',
      activeTokenRef.current?.dataset.tokenId,
      'document.activeElement BEFORE any logic:',
      document.activeElement === ref.current
        ? 'main_div'
        : document.activeElement?.getAttribute('data-token-id') ||
            document.activeElement?.tagName ||
            document.activeElement
    )

    if (savedCursorRef.current) {
      const definitelySavedCursor: { index: number; offset: number } =
        savedCursorRef.current
      // const savedCursorForThisEffect = definitelySavedCursor; // No longer directly used by executeFocusLogic top level

      const targetTokenId = definitelySavedCursor.index // Still needed for querying

      const executeFocusLogic = (foundTokenElement: HTMLElement | null) => {
        requestAnimationFrame(() => {
          // This is the inner rAF, where focus and cursor restoration happens
          const focusTarget = ref.current // Define focusTarget here, using the main div ref

          if (foundTokenElement) {
            // Logic for when the token IS found
            if (focusTarget && document.activeElement !== focusTarget) {
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] About to focus target (main_div). Current activeElement: ${document.activeElement?.tagName}`
              )
              focusTarget.focus({ preventScroll: true })
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] After focus target (main_div). Current activeElement: ${document.activeElement?.tagName}`
              )
            }

            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: START. foundTokenElement: ${foundTokenElement?.dataset.tokenId}, activeElement BEFORE: ${document.activeElement?.tagName}`
            )
            if (!focusTarget || !focusTarget.isConnected) {
              // Check focusTarget integrity
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: main div (focusTarget) disconnected. Bailing.`
              )
              return
            }
            if (!foundTokenElement.isConnected) {
              // Check foundTokenElement integrity
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: foundTokenElement disconnected. Bailing.`
              )
              return
            }

            if (!savedCursorRef.current) {
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: savedCursorRef is null. Bailing before restoreCursor.`
              )
              return
            }
            const cursorToEffect = savedCursorRef.current // Use the latest from the ref for restoration

            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: About to restoreCursor. Target: ${cursorToEffect.index}, Offset: ${cursorToEffect.offset}, Current activeElement: ${document.activeElement?.tagName}`
            )
            restoreCursor(cursorToEffect)
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: After restoreCursor. Current activeElement: ${document.activeElement === ref.current ? 'main_div' : document.activeElement?.getAttribute('data-token-id') || document.activeElement?.tagName}`
            )

            if (activeTokenRef.current !== foundTokenElement) {
              activeTokenRef.current = foundTokenElement
              onTokenFocus?.(cursorToEffect.index)
            }

            const currentExpectation = programmaticCursorExpectationRef.current
            let expectationMatchesRestoredCursor = false

            if (
              cursorToEffect &&
              typeof cursorToEffect.index === 'number' &&
              typeof cursorToEffect.offset === 'number'
            ) {
              if (
                currentExpectation &&
                currentExpectation.index === cursorToEffect.index &&
                currentExpectation.offset === cursorToEffect.offset
              ) {
                expectationMatchesRestoredCursor = true
              }
            }

            if (expectationMatchesRestoredCursor) {
              console.log(
                '[useLayoutEffect rAF_INNER] Clearing expectation because it matches what was just restored:',
                currentExpectation
              )
              programmaticCursorExpectationRef.current = null
            } else if (currentExpectation) {
              console.log(
                '[useLayoutEffect rAF_INNER] NOT clearing expectation. Expectation:',
                currentExpectation,
                'Restored cursor was:',
                cursorToEffect
              )
            }
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: END. activeElement AFTER: ${document.activeElement?.tagName}`
            )
          } else {
            // Logic for when the token is NOT found (still inside inner rAF)
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Target token element with ID ${targetTokenId} not found. Focusing main div. activeElement BEFORE: ${document.activeElement?.tagName}`
            )
            if (focusTarget && document.activeElement !== focusTarget) {
              focusTarget.focus({ preventScroll: true })
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Focused main div (token not found). activeElement AFTER: ${document.activeElement?.tagName}`
              )
            }
            if (activeTokenRef.current !== null) {
              activeTokenRef.current = null
              onTokenFocus?.(null)
            }
            // Only nullify savedCursorRef if the targetTokenId from the outer scope (definitelySavedCursor.index)
            // is what we were trying to act on. This avoids nulling it if another event changed it in the meantime.
            if (
              savedCursorRef.current &&
              savedCursorRef.current.index === targetTokenId
            ) {
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Clearing savedCursorRef as token ${targetTokenId} was not found.`
              )
              savedCursorRef.current = null
            }
          }
        })
      }

      const saved = savedCursorRef.current
      const activeIdx = activeTokenRef.current
        ? parseInt(activeTokenRef.current.dataset.tokenId!)
        : null

      const needsDoubleRAF =
        saved &&
        ref.current &&
        document.activeElement === ref.current && // Focus is on main div
        (activeIdx === null || activeIdx !== saved.index) // AND (no active token OR active token is different from where cursor wants to go)

      if (needsDoubleRAF) {
        console.log(
          `[useLayoutEffect #${currentDomKey}] Needs double rAF (new token focus?). Scheduling query and focus/restore in double rAF.`
        )
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF2] Running for needsDoubleRAF. Querying for token: ${targetTokenId}. activeElement BEFORE: ${document.activeElement?.tagName}`
            )
            // console.log(
            //   `[useLayoutEffect #${currentDomKey} rAF2] Current ref.current.innerHTML:`,
            //   ref.current?.innerHTML
            // )
            const tokenElementInRAF = ref.current?.querySelector(
              `[data-token-id="${targetTokenId}"]`
            ) as HTMLElement | null
            executeFocusLogic(tokenElementInRAF)
            // programmaticCursorExpectationRef.current = null; // Already handled in executeFocusLogic if successful
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF2] END. activeElement AFTER executeFocusLogic: ${document.activeElement?.tagName}`
            )
          })
        })
      } else {
        console.log(
          // Use domWasReKeyed in log for now to see its value, though it's not driving the path choice directly for this else.
          `[useLayoutEffect #${currentDomKey}] Needs single rAF (domWasReKeyed: ${domWasReKeyed}). Scheduling query and focus/restore in single rAF.`
        )
        requestAnimationFrame(() => {
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF1] Running. Querying for token: ${targetTokenId}. activeElement BEFORE: ${document.activeElement?.tagName}`
          )
          const targetTokenElement = ref.current?.querySelector(
            `[data-token-id="${targetTokenId}"]`
          ) as HTMLElement | null
          executeFocusLogic(targetTokenElement)
          // programmaticCursorExpectationRef.current = null; // Already handled in executeFocusLogic if successful
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF1] END. activeElement AFTER executeFocusLogic: ${document.activeElement?.tagName}`
          )
        })
      }
    } else {
      // No saved cursor
      console.log(
        `[useLayoutEffect #${currentDomKey}] No savedCursorRef.current. activeElement: ${document.activeElement?.tagName}`
      )
      if (
        tokens.length === 0 &&
        ref.current &&
        document.activeElement !== ref.current &&
        !ref.current.contains(document.activeElement)
      ) {
        console.log(
          `[useLayoutEffect #${currentDomKey}] No tokens, focusing main div. activeElement BEFORE: ${document.activeElement?.tagName}`
        )
        ref.current.focus()
        console.log(
          `[useLayoutEffect #${currentDomKey}] No tokens, focused main div. activeElement AFTER: ${document.activeElement?.tagName}`
        )
        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        }
      } else if (
        tokens.length > 0 &&
        ref.current &&
        document.activeElement === ref.current &&
        !activeTokenRef.current
      ) {
        console.log(
          '[useLayoutEffect] Tokens exist, main div active, no activeTokenRef. Focusing first token.'
        )
        const firstTokenEl = ref.current.querySelector(
          '[data-token-id="0"]'
        ) as HTMLElement | null
        if (firstTokenEl) {
          activeTokenRef.current = firstTokenEl
          onTokenFocus?.(0)
          savedCursorRef.current = { index: 0, offset: 0 }
          // Potentially need to focus firstTokenEl here and restore cursor if we want it active
        }
      }
    }
    prevDomKeyValueRef.current = currentDomKey
  }, [tokens, restoreCursor, ref, activeTokenRef, onTokenFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let preventDefaultCalled = false
    const setPreventDefaultFlag = () => {
      preventDefaultCalled = true
    }

    if (onCharInput && (e.key.length === 1 || e.key === 'Enter')) {
      // --- Determine active token info for the handle ---
      let tokenHandleForContext: TokenHandle<T> | null = null
      const currentActiveTokenElement = activeTokenRef.current

      if (
        currentActiveTokenElement &&
        currentActiveTokenElement.hasAttribute('data-token-id')
      ) {
        const activeIndex = parseInt(
          currentActiveTokenElement.getAttribute('data-token-id')!
        )
        const currentTokenValueFromState = tokens[activeIndex] // Value from state
        const currentTextInDOM =
          (currentActiveTokenElement.textContent === ZWS
            ? ''
            : currentActiveTokenElement.textContent) || ''
        const isEditable =
          currentActiveTokenElement.getAttribute('data-token-editable') ===
          'true'

        let cursorOffsetInToken = 0 // Default
        const selection = window.getSelection()
        if (
          selection &&
          selection.rangeCount > 0 &&
          currentActiveTokenElement.contains(selection.anchorNode)
        ) {
          const range = selection.getRangeAt(0)
          if (
            range.startContainer.nodeType === Node.TEXT_NODE &&
            range.startContainer.parentElement === currentActiveTokenElement
          ) {
            cursorOffsetInToken = range.startOffset
            // Adjust for ZWS if it's the only content and cursor is at 1
            if (
              range.startContainer.textContent === ZWS &&
              currentTextInDOM === '' && // Logical text is empty
              cursorOffsetInToken === 1
            ) {
              cursorOffsetInToken = 0
            }
          } else if (range.startContainer === currentActiveTokenElement) {
            // Cursor on the token span itself. Use savedRef if it's for this token.
            if (
              savedCursorRef.current &&
              savedCursorRef.current.index === activeIndex
            ) {
              cursorOffsetInToken = savedCursorRef.current.offset
            } else {
              // Fallback: offset 0 is start, >0 might be end.
              cursorOffsetInToken =
                range.startOffset === 0 ? 0 : currentTextInDOM.length
            }
          }
        } else if (
          savedCursorRef.current &&
          savedCursorRef.current.index === activeIndex
        ) {
          // Fallback to savedCursorRef if selection is not directly usable but saved ref matches
          cursorOffsetInToken = savedCursorRef.current.offset
        }
        // Ensure cursor offset is within bounds
        cursorOffsetInToken = Math.max(
          0,
          Math.min(cursorOffsetInToken, currentTextInDOM.length)
        )

        tokenHandleForContext = {
          value: currentTokenValueFromState,
          index: activeIndex,
          text: currentTextInDOM,
          cursorOffset: cursorOffsetInToken,
          isEditable,
          update: (newText, newCursorOffset) => {
            if (!isEditable) return
            const newTokenValue = parseToken(newText)
            if (newTokenValue !== null) {
              setTokens((prev) => {
                const updated = [...prev]
                updated[activeIndex] = newTokenValue
                return updated
              })
              const finalOffset = newCursorOffset ?? newText.length
              savedCursorRef.current = {
                index: activeIndex,
                offset: finalOffset
              }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              setPreventDefaultFlag()
            }
          },
          split: (options) => {
            if (
              !isEditable ||
              cursorOffsetInToken === 0 ||
              cursorOffsetInToken === currentTextInDOM.length
            ) {
              console.warn(
                '[TokenHandle.split] Cannot split at start or end of token or token not editable.'
              )
              return
            }
            const textForFirstPart = currentTextInDOM.substring(
              0,
              cursorOffsetInToken
            )
            const parsedFirstPart = parseToken(textForFirstPart)
            const parsedSecondPart = parseToken(options.textForSecondPart) // User provides raw text, action parses it

            if (parsedFirstPart !== null && parsedSecondPart !== null) {
              const newTokens = [...tokens]
              newTokens[activeIndex] = parsedFirstPart
              newTokens.splice(activeIndex + 1, 0, parsedSecondPart)

              const newSpacerCharsList = [...spacerChars]
              let actualSpacerForFirstPart: string | null
              if (options.spacerChar !== undefined) {
                actualSpacerForFirstPart = options.spacerChar
              } else {
                actualSpacerForFirstPart = insertSpacerOnCommit ? e.key : null
              }
              newSpacerCharsList[activeIndex] = actualSpacerForFirstPart
              newSpacerCharsList.splice(activeIndex + 1, 0, null) // Spacer for new second part is null

              while (newSpacerCharsList.length < newTokens.length)
                newSpacerCharsList.push(null)
              if (newSpacerCharsList.length > newTokens.length)
                newSpacerCharsList.length = newTokens.length

              setTokens(newTokens)
              setSpacerChars(newSpacerCharsList)
              savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              setPreventDefaultFlag()
            } else {
              console.warn(
                '[TokenHandle.split] Parsing failed for one or both parts of the split.'
              )
            }
          },
          commit: (options) => {
            if (!isEditable) return
            const committedValue = parseToken(currentTextInDOM) // Re-parse current DOM text before committing
            if (committedValue === null) {
              console.warn(
                '[TokenHandle.commit] Current token text is invalid, cannot commit.'
              )
              return
            }

            const newTokens = [...tokens]
            newTokens[activeIndex] = committedValue
            newTokens.splice(activeIndex + 1, 0, options.valueForNewToken)

            const newSpacerCharsList = [...spacerChars]
            let actualSpacerForCommittedToken: string | null
            if (options.spacerChar !== undefined) {
              actualSpacerForCommittedToken = options.spacerChar
            } else {
              actualSpacerForCommittedToken = insertSpacerOnCommit
                ? e.key
                : null
            }
            newSpacerCharsList[activeIndex] = actualSpacerForCommittedToken
            newSpacerCharsList.splice(activeIndex + 1, 0, null) // Spacer for new token is null

            while (newSpacerCharsList.length < newTokens.length)
              newSpacerCharsList.push(null)
            if (newSpacerCharsList.length > newTokens.length)
              newSpacerCharsList.length = newTokens.length

            setTokens(newTokens)
            setSpacerChars(newSpacerCharsList)
            savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setPreventDefaultFlag()
          },
          remove: () => {
            if (!isEditable && tokens.length === 1 && activeIndex === 0) {
              // Special case: allow removing the single non-editable token via this action
            } else if (!isEditable) {
              console.warn(
                '[TokenHandle.remove] Cannot remove non-editable token unless it is the only token.'
              )
              return
            }
            removeToken(activeIndex)
            setPreventDefaultFlag()
          }
        }
      }
      // --- End of active token info for handle ---

      const globalActionsForContext: OnInputGlobalActions<T> = {
        preventDefault: setPreventDefaultFlag,
        parse: parseToken,
        insert: (index, tokenValue, options) => {
          setTokens((prev) => {
            const newTokens = [...prev]
            newTokens.splice(index, 0, tokenValue)
            return newTokens
          })
          setSpacerChars((prevSpacers) => {
            // prevSpacers should be in sync with tokens.length BEFORE this insertion.
            const newSpacers = [...prevSpacers]

            // If a spacer is specified for the token *before* the inserted one, set it.
            if (index > 0 && options?.spacerCharForPrevious !== undefined) {
              if (index - 1 < newSpacers.length) {
                // Ensure index-1 is valid
                newSpacers[index - 1] = options.spacerCharForPrevious
              } else {
                // This case implies prevSpacers might be unexpectedly short.
                // Pad and set. This should ideally not be hit if useEffect syncs length.
                while (newSpacers.length < index - 1) newSpacers.push(null)
                newSpacers[index - 1] = options.spacerCharForPrevious
              }
            }

            // Insert a 'null' spacer for the newly added token at 'index'.
            // This increases the length of newSpacers by 1.
            newSpacers.splice(index, 0, null)

            // After the splice, newSpacers.length should be tokens.length (before this op) + 1.
            // This is the correct length for the new number of tokens.
            // The useEffect syncing spacerChars.length to tokens.length will handle future consistency.
            return newSpacers
          })
          let cursorOffset = 0
          if (options?.cursorAt === 'end')
            cursorOffset = String(tokenValue ?? '').length
          else if (typeof options?.cursorAt === 'object')
            cursorOffset = options.cursorAt.offset
          savedCursorRef.current = { index, offset: cursorOffset }
          programmaticCursorExpectationRef.current = savedCursorRef.current
          setPreventDefaultFlag()
        },
        removeAt: (indexToRemove) => {
          removeToken(indexToRemove)
          // removeToken itself doesn't call preventDefault, so if onCharInput uses this, it should also call preventDefault if needed.
          // For now, let's assume direct usage of removeAt implies handling.
          setPreventDefaultFlag()
        },
        replaceAll: (newTokens, newCursor, newSpacers) => {
          setTokens(newTokens)
          if (newSpacers) {
            setSpacerChars(newSpacers)
          } else {
            setSpacerChars(Array(newTokens.length).fill(null))
          }
          savedCursorRef.current = newCursor
          programmaticCursorExpectationRef.current = newCursor
          setPreventDefaultFlag()
        }
      }

      const contextForOnCharInput: OnInputContext<T> = {
        key: e.key,
        tokens: [...tokens], // Pass a snapshot
        token: tokenHandleForContext,
        actions: globalActionsForContext
      }

      onCharInput(contextForOnCharInput)

      if (preventDefaultCalled) {
        e.preventDefault()
        if (selectAllStateRef.current !== 'none') {
          console.log(
            '[handleKeyDown] Resetting selectAllStateRef from',
            selectAllStateRef.current,
            'after onCharInput handled event.'
          )
          selectAllStateRef.current = 'none'
        }
        return // onCharInput handled it, skip default commit logic
      }
    }

    // Default commit logic (only if onCharInput didn't preventDefault)
    if (commitOnChars && commitOnChars.includes(e.key)) {
      if (
        activeTokenRef.current &&
        activeTokenRef.current.getAttribute('data-token-editable') === 'true'
      ) {
        e.preventDefault() // Prevent default early, as we are likely handling it.

        const activeTokenElement = activeTokenRef.current
        const activeIndex = parseInt(
          activeTokenElement.getAttribute('data-token-id')!
        )
        const currentTokenText =
          (activeTokenElement.textContent === ZWS
            ? ''
            : activeTokenElement.textContent) || ''

        let charOffsetInToken = -1
        const selection = window.getSelection()

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const container = range.startContainer
          const offset = range.startOffset

          if (activeTokenElement.contains(container)) {
            if (
              container.nodeType === Node.TEXT_NODE &&
              container.parentElement === activeTokenElement
            ) {
              charOffsetInToken = offset
              if (
                container.textContent === ZWS &&
                currentTokenText === '' &&
                charOffsetInToken === 1
              ) {
                // If token is ZWS (appears as length 1 in DOM) but logically empty string,
                // and cursor is at offset 1 (after ZWS), treat as offset 0 for splitting ''
                charOffsetInToken = 0
              }
            } else if (container === activeTokenElement) {
              // Cursor on the token span. Use savedCursor if available and for this token.
              if (
                savedCursorRef.current &&
                savedCursorRef.current.index === activeIndex
              ) {
                charOffsetInToken = savedCursorRef.current.offset
              } else {
                // Fallback: offset 0 is start, >0 might be end. For splitting, this is ambiguous.
                charOffsetInToken = offset === 0 ? 0 : currentTokenText.length
              }
            } else {
              // Cursor in nested element or complex scenario. Try savedCursor.
              if (
                savedCursorRef.current &&
                savedCursorRef.current.index === activeIndex
              ) {
                charOffsetInToken = savedCursorRef.current.offset
              } else {
                // Still can't determine, default to end to avoid splitting errors
                charOffsetInToken = currentTokenText.length
              }
            }
          }
        }
        // Final safety clamp for charOffsetInToken
        if (charOffsetInToken < 0 && currentTokenText.length > 0)
          charOffsetInToken = currentTokenText.length
        else if (charOffsetInToken < 0) charOffsetInToken = 0
        if (charOffsetInToken > currentTokenText.length)
          charOffsetInToken = currentTokenText.length

        const canSplit =
          currentTokenText !== '' && // Cannot split an truly empty string token
          charOffsetInToken > 0 &&
          charOffsetInToken < currentTokenText.length

        console.log(
          `[handleKeyDown commitChar] char: '${e.key}', activeIndex: ${activeIndex}, ` +
            `currentTokenText: "${currentTokenText}" (len: ${currentTokenText.length}), ` +
            `charOffsetInToken: ${charOffsetInToken}, canSplit: ${canSplit}`
        )

        if (canSplit) {
          const textBeforeSplit = currentTokenText.substring(
            0,
            charOffsetInToken
          )
          const textAfterSplit = currentTokenText.substring(charOffsetInToken)

          const token1 = parseToken(textBeforeSplit)
          const token2 = parseToken(textAfterSplit)

          if (token1 !== null && token2 !== null) {
            console.log(
              `[handleKeyDown commitChar] SPLIT successful. token1: "${String(token1)}", token2: "${String(token2)}"`
            )
            const newTokens = [...tokens]
            newTokens[activeIndex] = token1
            newTokens.splice(activeIndex + 1, 0, token2)

            const newSpacerCharsList = [...spacerChars]
            if (displayCommitCharSpacer) {
              newSpacerCharsList[activeIndex] = e.key
            } else {
              newSpacerCharsList[activeIndex] = null
            }
            newSpacerCharsList.splice(activeIndex + 1, 0, null) // Spacer for the new token2

            setTokens(newTokens)
            setSpacerChars(newSpacerCharsList)
            savedCursorRef.current = { index: activeIndex + 1, offset: 0 } // Cursor at start of the second part (token2)
            programmaticCursorExpectationRef.current = savedCursorRef.current
            return // Split handled
          } else {
            console.warn(
              `[handleKeyDown commitChar] SPLIT failed: parseToken returned null for one/both parts. ` +
                `Before: "${textBeforeSplit}" (parsed: ${token1}), After: "${textAfterSplit}" (parsed: ${token2}). No action taken.`
            )
            return // Explicitly do nothing more if split parsing fails, default was already prevented
          }
        }

        // Fallback to standard commit logic (if not split)
        console.log(
          `[handleKeyDown commitChar] Not a split scenario or split failed. Proceeding with standard commit. ` +
            `Full text: "${currentTokenText}", charOffsetInToken: ${charOffsetInToken}`
        )
        const committedValue = parseToken(currentTokenText) // Parse the original full text

        if (committedValue !== null) {
          const newTokens = [...tokens] // Start with current tokens
          newTokens[activeIndex] = committedValue // Update the current token with its (potentially re-parsed) full value

          let focusMovedToNewToken = false
          const newSpacerCharsList = [...spacerChars] // Start with current spacers

          if (addNewTokenOnCommit) {
            let valueForNewSlot: T | undefined | null = defaultNewTokenValue
            if (valueForNewSlot === undefined) {
              valueForNewSlot = parseToken('') // Default new token is usually empty
            }

            if (valueForNewSlot !== null) {
              newTokens.splice(activeIndex + 1, 0, valueForNewSlot) // Insert new token

              // Spacer logic for commit: use new insertSpacerOnCommit prop
              if (insertSpacerOnCommit) {
                // <<< MODIFIED HERE
                newSpacerCharsList[activeIndex] = e.key // Spacer for the committed token (original activeIndex)
              } else {
                newSpacerCharsList[activeIndex] = null
              }
              // Add spacer for the newly added token (typically null)
              // Ensure spacer list is long enough if new token is at the very end
              while (newSpacerCharsList.length <= activeIndex + 1)
                newSpacerCharsList.push(null)
              newSpacerCharsList.splice(activeIndex + 1, 0, null) // Insert null spacer for new token
              // If splice results in too many, trim (though logic above should keep it sync with newTokens)
              if (newSpacerCharsList.length > newTokens.length) {
                newSpacerCharsList.length = newTokens.length
              }

              savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              focusMovedToNewToken = true
            } else {
              // New token slot was null, don't add spacer char if no new token follows
              newSpacerCharsList[activeIndex] = null
            }
          } else {
            // Not adding new token, so no spacer character is logically placed *after* this token for commit
            newSpacerCharsList[activeIndex] = null
          }

          if (!focusMovedToNewToken) {
            const committedTokenTextLength = String(committedValue ?? '').length
            savedCursorRef.current = {
              index: activeIndex,
              offset: committedTokenTextLength
            }
            programmaticCursorExpectationRef.current = savedCursorRef.current
          }
          console.log(
            '[handleKeyDown commitChar] Standard commit: Attempting to set tokens:',
            newTokens,
            'and spacerChars:',
            newSpacerCharsList
          )
          setSpacerChars(newSpacerCharsList)
          setTokens(newTokens)
        } else {
          console.warn(
            `[handleKeyDown commitChar] Standard commit: parseToken returned null for full text "${currentTokenText}". Doing nothing.`
          )
        }
        return // End of commit char handling (standard path)
      }
      // Potentially handle e.key === 'Enter' if it's NOT a commitOnChar but needs special global handling
      // (This part of the original logic seems fine if Enter isn't a commit char)
      if (e.key === 'Enter') {
        e.preventDefault()
      }
    }
  }

  const _onBeforeInputHandler = <TIn,>(
    e: React.FormEvent<HTMLDivElement>,
    {
      currentTokens: localCurrentTokens,
      activeTokenRef: localActiveTokenRef,
      parseTokenFn,
      setTokensFn,
      savedCursorRefObj
    }: {
      currentTokens: Readonly<TIn[]>
      activeTokenRef: React.RefObject<HTMLElement | null>
      parseTokenFn: (value: string) => TIn | null
      setTokensFn: (tokens: TIn[]) => void
      savedCursorRefObj: React.MutableRefObject<{
        index: number
        offset: number
      } | null>
    }
  ) => {
    const event = e.nativeEvent as InputEvent
    console.log(
      '[_onBeforeInputHandler RAW EVENT] inputType:',
      event.inputType,
      'data:',
      event.data
    )

    if (event.inputType === 'insertParagraph') {
      // Potentially allow Enter key to be handled by onKeyDown for commitOnChars, etc.
      // If not handled there, it might insert a div/br, which could be undesirable.
      // For now, let it pass through; handleKeyDown should take precedence if 'Enter' is a commitChar.
      // If 'Enter' is not a commitChar, default behavior might be okay or might need explicit prevention.
      return
    }

    const isDeletion =
      event.inputType === 'deleteContentBackward' ||
      event.inputType === 'deleteContentForward'

    // Only proceed if there's data to insert or it's a deletion.
    // This helps filter out other beforeinput events like format changes if they were to occur.
    if (!event.data && !isDeletion) {
      return
    }

    console.log(
      '[_onBeforeInputHandler START] inputType:',
      event.inputType,
      'data:',
      event.data,
      'document.activeElement:',
      document.activeElement === ref.current
        ? 'main_div'
        : document.activeElement?.getAttribute('data-token-id') ||
            document.activeElement,
      'localActiveTokenRef.current:',
      localActiveTokenRef.current?.dataset.tokenId,
      'Target element of event:',
      (event.target as HTMLElement)?.dataset?.tokenId ||
        (
          (event.target as Node)?.parentElement?.closest?.(
            '[data-token-id]'
          ) as HTMLElement
        )?.dataset?.tokenId ||
        (event.target === ref.current ? 'main_div' : event.target)
    )

    const targetIsWithinActiveToken =
      localActiveTokenRef.current &&
      event.target &&
      localActiveTokenRef.current.contains(event.target as Node)

    if (
      localActiveTokenRef.current &&
      localActiveTokenRef.current.getAttribute('data-token-editable') ===
        'true' &&
      ref.current &&
      ref.current.contains(localActiveTokenRef.current) &&
      (document.activeElement === ref.current || // Focus might be on main div but logical token is active
        targetIsWithinActiveToken || // Event target is within the active token
        localActiveTokenRef.current.textContent === ZWS) // Active token is empty (ZWS)
    ) {
      const activeTokenElement = localActiveTokenRef.current
      const activeTokenId = activeTokenElement.getAttribute('data-token-id')
      if (!activeTokenId) return
      const activeIndex = parseInt(activeTokenId)

      if (isDeletion) {
        e.preventDefault() // Prevent browser's native deletion
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const currentTextInToken =
          activeTokenElement.textContent === ZWS
            ? ''
            : activeTokenElement.textContent || ''
        let newTextForToken = currentTextInToken
        let newCursorOffset = range.startOffset

        // Check if selection is within the text node of the active token
        if (
          activeTokenElement.firstChild === range.startContainer &&
          activeTokenElement.firstChild === range.endContainer &&
          range.startContainer.nodeType === Node.TEXT_NODE
        ) {
          if (range.collapsed) {
            // Single character deletion
            const currentOffset = range.startOffset
            if (event.inputType === 'deleteContentBackward') {
              if (currentOffset === 0) {
                // CHECK FOR SPACER DELETION HERE
                if (activeIndex > 0 && spacerChars[activeIndex - 1]) {
                  e.preventDefault()
                  const newSpacerChars = [...spacerChars]
                  newSpacerChars[activeIndex - 1] = null
                  setSpacerChars(newSpacerChars)
                  const prevTokenForCursor = localCurrentTokens[activeIndex - 1]
                  savedCursorRefObj.current = {
                    index: activeIndex - 1,
                    offset: String(prevTokenForCursor ?? '').length
                  }
                  programmaticCursorExpectationRef.current =
                    savedCursorRefObj.current
                  return // Spacer deletion handled
                }

                // TOKEN MERGE LOGIC
                if (activeIndex > 0) {
                  const prevTokenValue = localCurrentTokens[activeIndex - 1]
                  const currentTokenValue = localCurrentTokens[activeIndex]
                  const currentTokenTextForMerge =
                    currentTokenValue === ZWS
                      ? ''
                      : String(currentTokenValue ?? '')
                  const prevTokenTextForMerge =
                    prevTokenValue === ZWS ? '' : String(prevTokenValue ?? '')
                  const mergedText =
                    prevTokenTextForMerge + currentTokenTextForMerge
                  const newParsedMergedToken = parseTokenFn(mergedText)

                  if (newParsedMergedToken !== null) {
                    e.preventDefault()
                    const updatedTokens = [...localCurrentTokens]
                    updatedTokens[activeIndex - 1] = newParsedMergedToken
                    const finalNewTokens = updatedTokens.filter(
                      (_, idx) => idx !== activeIndex
                    )
                    const finalNewSpacerChars = spacerChars.filter(
                      (_, idx) => idx !== activeIndex - 1
                    )

                    setTokensFn(finalNewTokens as TIn[])
                    setSpacerChars(finalNewSpacerChars)

                    savedCursorRefObj.current = {
                      index: activeIndex - 1,
                      offset: prevTokenTextForMerge.length
                    }
                    programmaticCursorExpectationRef.current =
                      savedCursorRefObj.current
                    return // Merge handled successfully
                  } else {
                    console.warn(
                      '[_onBeforeInputHandler] Token merge attempt failed (invalid token), falling through.'
                    )
                  }
                }

                // Fall-through if not handled by spacer deletion or successful merge
                console.log(
                  '[_onBeforeInputHandler] Backspace at start of text node (no spacer/merge occurred). Letting onKeyDown handle.'
                )
                return // Let onKeyDown take over
              }
              newTextForToken =
                currentTextInToken.slice(0, currentOffset - 1) +
                currentTextInToken.slice(currentOffset)
              newCursorOffset = currentOffset - 1
            } else if (event.inputType === 'deleteContentForward') {
              // 'deleteContentForward'
              if (currentOffset === currentTextInToken.length) {
                // Delete at end of token - let onKeyDown handle merge/token removal
                console.log(
                  '[_onBeforeInputHandler] Delete at end of text node. Letting onKeyDown handle.'
                )
                // CHECK FOR SPACER DELETION HERE
                if (
                  activeIndex < localCurrentTokens.length - 1 &&
                  spacerChars[activeIndex]
                ) {
                  e.preventDefault()
                  const newSpacerChars = [...spacerChars]
                  newSpacerChars[activeIndex] = null
                  setSpacerChars(newSpacerChars)
                  // Cursor remains at start of current token (which is effectively the position after the deleted spacer)
                  savedCursorRefObj.current = {
                    index: activeIndex,
                    offset: 0 // Or should it be next token, offset 0 if spacer was between active and next?
                    // Let's assume for now it is end of current, which becomes start of next logically.
                    // Current token's content is not changed. Cursor should be at its end.
                    // No, cursor should be at start of current token, as the spacer *after* it was deleted.
                  }
                  // Correction: If spacer after current token is deleted, cursor should effectively be at end of current token,
                  // effectively being before the *next* token.
                  // Let's re-evaluate cursor placement for spacer deletion.
                  // If we delete spacer after token A (index `activeIndex`), cursor should effectively be at end of token A.
                  // The *next* token is `activeIndex + 1`.

                  // If we delete `spacerCharsListRef.current[activeIndex]`, that spacer was *after* `tokens[activeIndex]`.
                  // The cursor should remain conceptually at the end of `tokens[activeIndex]`, or start of `tokens[activeIndex+1]`
                  // if that token is focused. Given we are in `tokens[activeIndex]`, set to its end.
                  savedCursorRefObj.current = {
                    index: activeIndex,
                    offset: String(localCurrentTokens[activeIndex] ?? '').length
                  }
                  programmaticCursorExpectationRef.current =
                    savedCursorRefObj.current
                  // setTokensFn([...localCurrentTokens] as TIn[]); // Force update - REMOVING THIS
                  return
                }
                return
              }
              newTextForToken =
                currentTextInToken.slice(0, range.startOffset) +
                currentTextInToken.slice(range.endOffset)
              newCursorOffset = range.startOffset
            }
          } else if (currentTextInToken === '' && isDeletion) {
            // Deleting an already empty (ZWS) token, effectively.
            // This should ideally lead to token removal, let onKeyDown handle it.
            console.log(
              '[_onBeforeInputHandler] Deletion on empty (ZWS) token. Letting onKeyDown handle.'
            )
            return
          } else {
            // Complex selection or not directly on the primary text node.
            // This might occur if selection spans multiple nodes or includes the token element itself.
            // Let onKeyDown handle these more complex cases for now.
            console.warn(
              '[_onBeforeInputHandler] Deletion with complex selection or not in primary text node. Letting onKeyDown handle.'
            )
            return
          }

          const newValueForToken = parseTokenFn(newTextForToken)

          if (newValueForToken === null) {
            // Token became invalid/empty after deletion, remove it.
            console.log(
              '[_onBeforeInputHandler] Token became null after deletion, removing token:',
              activeIndex
            )
            const newTokens = localCurrentTokens.filter(
              (_, i) => i !== activeIndex
            )
            setTokensFn(newTokens as TIn[])

            if (newTokens.length === 0) {
              savedCursorRefObj.current = null
              programmaticCursorExpectationRef.current = null
            } else if (activeIndex >= newTokens.length) {
              // If last token was removed
              const lastToken = newTokens[newTokens.length - 1]
              savedCursorRefObj.current = {
                index: newTokens.length - 1,
                offset: String(lastToken ?? '').length
              }
              programmaticCursorExpectationRef.current =
                savedCursorRefObj.current
            } else {
              // A token before the end was removed
              savedCursorRefObj.current = { index: activeIndex, offset: 0 }
              programmaticCursorExpectationRef.current =
                savedCursorRefObj.current
            }
          } else {
            // Token updated
            const newTokens = [...localCurrentTokens]
            if (activeIndex >= 0 && activeIndex < newTokens.length) {
              newTokens[activeIndex] = newValueForToken
              setTokensFn(newTokens as TIn[])
              savedCursorRefObj.current = {
                index: activeIndex,
                offset: newCursorOffset
              }
              programmaticCursorExpectationRef.current =
                savedCursorRefObj.current
            } else {
              console.error(
                "[_onBeforeInputHandler] activeIndex out of bounds for deletion. This shouldn't happen."
              )
            }
          }
        }
        return // Deletion handled
      } else if (event.data) {
        // Character insertion
        const charTyped = event.data
        e.preventDefault() // Prevent browser's native insertion

        const currentTextInToken =
          activeTokenElement.textContent === ZWS
            ? ''
            : activeTokenElement.textContent || ''
        let newTextForToken = ''
        let newCursorOffset = 0

        let originalInsertionOffset: number

        if (
          savedCursorRefObj.current &&
          savedCursorRefObj.current.index === activeIndex
        ) {
          // Trust our saved cursor position for this token if it matches the active token index
          originalInsertionOffset = savedCursorRefObj.current.offset
          console.log(
            '[_onBeforeInputHandler] Using savedCursorRef offset for insertion. Index:',
            activeIndex,
            'Saved Offset:',
            originalInsertionOffset
          )
        } else {
          // Fallback to current DOM selection if savedCursorRef is not for this token or is null.
          // This path indicates a potential state inconsistency or initial state.
          const selection = window.getSelection()
          if (
            selection &&
            selection.rangeCount > 0 &&
            selection.anchorNode &&
            activeTokenElement.contains(selection.anchorNode)
          ) {
            const range = selection.getRangeAt(0)
            originalInsertionOffset =
              range.startContainer === activeTokenElement
                ? currentTextInToken.length
                : range.startOffset
          } else {
            originalInsertionOffset = currentTextInToken.length // Default to end if no clear selection within token
          }
          console.warn(
            '[_onBeforeInputHandler] Falling back to DOM selection for insertion offset. Index:',
            activeIndex,
            'DOM Offset Used:',
            originalInsertionOffset,
            'SavedCursor:',
            savedCursorRefObj.current
          )
        }

        // Ensure originalInsertionOffset is within bounds of currentTextInToken
        originalInsertionOffset = Math.max(
          0,
          Math.min(originalInsertionOffset, currentTextInToken.length)
        )

        // Construct new text based on char typed at the determined originalInsertionOffset
        // This assumes character insertion, not range replacement, as we're trusting our cursor state.
        newTextForToken =
          currentTextInToken.slice(0, originalInsertionOffset) +
          charTyped +
          currentTextInToken.slice(originalInsertionOffset) // Insert char, push rest of string
        newCursorOffset = originalInsertionOffset + charTyped.length

        console.log(
          '[_onBeforeInputHandler] Character insertion. OriginalOffset Used:',
          originalInsertionOffset,
          'NewText:',
          JSON.stringify(newTextForToken),
          'NewOffset:',
          newCursorOffset
        )

        const newValueForToken = parseTokenFn(newTextForToken)
        if (newValueForToken !== null) {
          const newTokens = [...localCurrentTokens]
          if (activeIndex >= 0 && activeIndex < newTokens.length) {
            newTokens[activeIndex] = newValueForToken
            setTokensFn(newTokens as TIn[])
            savedCursorRefObj.current = {
              index: activeIndex,
              offset: newCursorOffset
            }
            programmaticCursorExpectationRef.current = savedCursorRefObj.current
          } else {
            console.error(
              "[_onBeforeInputHandler] activeIndex out of bounds for insertion. This shouldn't happen."
            )
          }
        } else {
          console.warn(
            '[_onBeforeInputHandler] Input resulted in null token, input ignored. Text was:',
            newTextForToken
          )
        }
        return // Insertion handled
      }
    } else if (
      event.data &&
      !localActiveTokenRef.current &&
      document.activeElement === ref.current
    ) {
      // Input is happening directly in the root contentEditable div, not in a specific token.
      e.preventDefault() // Prevent browser from inserting character into the root div
      const charTyped = event.data
      const constTextForNewToken = charTyped // Renamed to avoid conflict, and made const

      const newParsedToken = parseTokenFn(constTextForNewToken)

      if (newParsedToken !== null) {
        const newTokens = [...localCurrentTokens]
        // Simplest: add as a new token.
        newTokens.push(newParsedToken)
        setTokensFn(newTokens as TIn[])
        savedCursorRefObj.current = {
          index: newTokens.length - 1,
          offset: constTextForNewToken.length
        }
        programmaticCursorExpectationRef.current = savedCursorRefObj.current
        console.log(
          '[_onBeforeInputHandler] Handled root input. New token created:',
          JSON.stringify(newParsedToken),
          'New tokens:',
          JSON.stringify(newTokens)
        )
      } else {
        console.warn(
          '[_onBeforeInputHandler] Root input resulted in null token, input ignored. Text was:',
          constTextForNewToken
        )
      }
      return // Root input handled
    }
    console.log(
      '[_onBeforeInputHandler] Event not explicitly handled, allowing default or other handlers. Type:',
      event.inputType,
      'Data:',
      event.data
    )
  }

  const Comp = asChild ? Slot : 'div'

  return (
    <InlayProvider
      scope={__scope}
      onTokenChange={onTokenChange as any}
      activeTokenRef={activeTokenRef}
      tokens={tokens as any}
      onInput={onInput}
      updateToken={updateToken as any}
      parseToken={parseToken as any}
      removeToken={removeToken}
      restoreCursor={restoreCursor}
      saveCursor={saveCursor}
      spacerChars={spacerChars}
      displayCommitCharSpacer={displayCommitCharSpacer}
      renderSpacer={renderSpacer}
      onCharInput={onCharInput as any} // Added as any here
    >
      <Comp
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onBeforeInput={(e) =>
          _onBeforeInputHandler(e, {
            currentTokens: tokens,
            activeTokenRef: activeTokenRef,
            parseTokenFn: parseToken,
            setTokensFn: setTokens,
            savedCursorRefObj: savedCursorRef
          })
        }
        onKeyDown={(e) => {
          const isCtrlA =
            (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'

          if (isCtrlA) {
            e.preventDefault() // Always prevent default for Ctrl+A to manage selection manually
            const localActiveToken = activeTokenRef.current
            const sel = window.getSelection()

            const isActiveTokenEffectivelyBlank =
              localActiveToken &&
              (!localActiveToken.textContent ||
                localActiveToken.textContent === ZWS)

            if (
              localActiveToken &&
              localActiveToken.getAttribute('data-token-editable') === 'true' &&
              !isActiveTokenEffectivelyBlank && // Check if token is not blank
              ref.current &&
              ref.current.contains(localActiveToken) &&
              selectAllStateRef.current === 'none' &&
              sel
            ) {
              console.log(
                '[onKeyDown Ctrl+A] First Ctrl+A: Selecting non-blank token',
                localActiveToken.dataset.tokenId
              )
              const range = document.createRange()
              range.selectNodeContents(localActiveToken)
              sel.removeAllRanges()
              sel.addRange(range)
              selectAllStateRef.current = 'token'
            } else if (sel && ref.current) {
              // Second Ctrl+A or Ctrl+A in root, or if first Ctrl+A condition wasn't met
              console.log(
                '[onKeyDown Ctrl+A] Second Ctrl+A or root: Selecting all in root. Current selectAllStateRef was:',
                selectAllStateRef.current
              )
              sel.removeAllRanges()
              const range = document.createRange()
              range.selectNodeContents(ref.current)
              sel.addRange(range)
              selectAllStateRef.current = 'all'
              // Explicitly clear active token and saved cursor for global selection
              if (activeTokenRef.current !== null) {
                activeTokenRef.current = null
                // Do not call onTokenFocus here, as we want the global selection visual
              }
              savedCursorRef.current = null
            }
            return // Ctrl+A is fully handled.
          }

          // For other keys:
          const selectAllStateBeforeKeyProcessing = selectAllStateRef.current
          const isModifierKey =
            e.ctrlKey ||
            e.metaKey ||
            e.altKey ||
            e.key === 'Shift' ||
            e.key === 'Control' ||
            e.key === 'Meta' ||
            e.key === 'Alt'

          if (!isModifierKey && e.key !== 'Backspace' && e.key !== 'Delete') {
            if (selectAllStateRef.current !== 'none') {
              console.log(
                '[onKeyDown] Resetting selectAllStateRef from',
                selectAllStateRef.current,
                'due to other key:',
                e.key
              )
              selectAllStateRef.current = 'none'
            }
          }

          handleKeyDown(e) // For commitOnChars
          if (e.defaultPrevented) {
            if (selectAllStateRef.current !== 'none') {
              console.log(
                '[onKeyDown] Resetting selectAllStateRef from',
                selectAllStateRef.current,
                'after commit character handled event.'
              )
              selectAllStateRef.current = 'none'
            }
            return
          }

          if (e.key === 'Backspace' || e.key === 'Delete') {
            // Pass the state *before* this key might have reset it above in non-modifier check
            handleRemoveTokenOnKeyDown(e, selectAllStateBeforeKeyProcessing)

            // If Backspace/Delete was handled based on a selectAllState, reset the state.
            if (
              selectAllStateBeforeKeyProcessing !== 'none' &&
              e.defaultPrevented
            ) {
              console.log(
                '[onKeyDown] Resetting selectAllStateRef from',
                selectAllStateBeforeKeyProcessing,
                'after handled Backspace/Delete'
              )
              selectAllStateRef.current = 'none'
            }
            if (e.defaultPrevented) return
          }
        }}
        ref={composeRefs(forwardedRef, ref)}
        {...props}
      >
        {children}
      </Comp>
    </InlayProvider>
  )
}

type InlayTokenProps = {
  index: number
  children: React.ReactNode
  asChild?: boolean
  editable?: boolean
}

const InlayToken = React.forwardRef<
  HTMLDivElement,
  ScopedProps<InlayTokenProps>
>(({ index, children, asChild, __scope, editable = false }, forwardedRef) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const { activeTokenRef } = useInlayContext(COMPONENT_NAME, __scope)
  // Removed displayCommitCharSpacer from destructuring as it's not directly used here for the condition
  const { spacerChars, renderSpacer, tokens } = useInlayContext(
    // Added tokens
    COMPONENT_NAME,
    __scope
  )

  let displayContent: React.ReactNode = children
  const isEffectivelyEditable =
    editable || activeTokenRef.current === ref.current

  if (
    typeof children === 'string' &&
    children === '' &&
    isEffectivelyEditable
  ) {
    displayContent = ZWS
  }

  const Comp = asChild ? Slot : 'span'

  return (
    <>
      <Comp
        ref={composeRefs(forwardedRef, ref)}
        data-token-id={index}
        data-token-editable={editable}
        contentEditable={isEffectivelyEditable}
        suppressContentEditableWarning
        onBeforeInput={(e) => {
          const event = e.nativeEvent as InputEvent
          console.log(
            '[InlayToken onBeforeInput] SPAN Index:',
            index,
            'inputType:',
            event.inputType,
            'data:',
            event.data,
            'target:',
            e.target,
            'currentTarget:',
            e.currentTarget
          )
        }}
      >
        {displayContent}
      </Comp>
      {/* If a spacer char is set for this token's index in state, call renderSpacer */}
      {index < tokens.length - 1 && // Only render if not the last token
        spacerChars &&
        spacerChars[index] &&
        renderSpacer(spacerChars[index]!, index)}
    </>
  )
})

InlayToken.displayName = 'InlayToken'

export function createInlay<T>() {
  const Root = React.forwardRef(_Inlay<T>)
  return {
    Root,
    Token: InlayToken as React.ForwardRefExoticComponent<
      InlayTokenProps & { children: T } & React.RefAttributes<HTMLDivElement>
    >
  } as const
}

export const { Root, Token } = createInlay<string>()
