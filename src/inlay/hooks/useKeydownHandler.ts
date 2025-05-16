import * as React from 'react'
import { ZWS } from '../inlay.constants'
import type {
  // TokenHandle, // Unused
  // OnInputGlobalActions, // Unused
  // OnInputContext, // Unused directly, but InlayProps uses it via onCharInput prop type
  InlayProps,
  OnInputGlobalActions,
  TokenHandle,
  CaretPosition,
  InlayOperationType
} from '../inlay.types'
import type { SelectAllState } from './useSelectionChangeHandler' // Import SelectAllState

// Re-import OnInputContext specifically if needed for the onCharInput prop type directly
import type { OnInputContext } from '../inlay.types'
import type { UseInlayHistoryReturn } from './useInlayHistory' // Added

const DEBUG_HISTORY = true // Control flag for logging

export type UseKeydownHandlerProps<T> = {
  tokens: Readonly<T[]>
  setTokens: React.Dispatch<React.SetStateAction<T[]>>
  spacerChars: (string | null)[]
  setSpacerChars: React.Dispatch<React.SetStateAction<(string | null)[]>>
  activeTokenRef: React.RefObject<HTMLElement | null>
  savedCursorRef: React.MutableRefObject<CaretPosition | null>
  programmaticCursorExpectationRef: React.MutableRefObject<CaretPosition | null>
  mainDivRef: React.RefObject<HTMLDivElement | null> // ref from _Inlay
  selectAllStateRef: React.MutableRefObject<SelectAllState> // Use SelectAllState here

  // Callbacks from _Inlay or its props
  parseToken: (value: string) => T | null
  removeToken: (index: number) => void // This is the removeToken from _Inlay's scope
  saveCursor: () => void // This is the saveCursor from _Inlay's scope
  restoreCursor: (cursorToRestore?: CaretPosition | null) => void // Expose restoreCursor for programmatic focus
  onTokenFocus?: (index: number | null) => void

  // Props from InlayProps<T>
  onCharInput?: (context: OnInputContext<T>) => void
  commitOnChars?: string[]
  defaultNewTokenValue?: T
  addNewTokenOnCommit: boolean // Needs to be passed (has default in _Inlay)
  insertSpacerOnCommit: boolean // Needs to be passed (has default in _Inlay)
  displayCommitCharSpacer?: InlayProps<T>['displayCommitCharSpacer']

  // For retrieving EditableText values
  _getEditableTextValue: (index: number) => string | undefined
  forceImmediateRestoreRef: React.MutableRefObject<boolean>

  // New props for history
  history: UseInlayHistoryReturn<T>
  isRestoringHistoryRef: React.MutableRefObject<boolean>
  setCaretState: React.Dispatch<React.SetStateAction<CaretPosition | null>> // Added setter for caretState
  lastOperationTypeRef: React.MutableRefObject<InlayOperationType>
  multiline?: boolean // Add multiline prop
}

export function useKeydownHandler<T>(props: UseKeydownHandlerProps<T>) {
  const {
    tokens,
    setTokens,
    spacerChars,
    setSpacerChars,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    mainDivRef,
    selectAllStateRef,
    parseToken,
    removeToken,
    saveCursor, // Added from props
    restoreCursor, // Added from props
    onTokenFocus,
    onCharInput,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    displayCommitCharSpacer,
    _getEditableTextValue,
    forceImmediateRestoreRef,
    // New props for history
    history, // Destructure
    isRestoringHistoryRef, // Destructure
    setCaretState, // Destructure
    lastOperationTypeRef,
    multiline // Destructure multiline
  } = props

  // Helper function to get the meaningful string representation of a token
  const getActualTextForToken = React.useCallback(
    (tok: T | undefined | null, tokenIndex: number): string => {
      if (tok === undefined || tok === null) return ''

      // First, try to get value from registered EditableText components via context
      const registeredValue = _getEditableTextValue(tokenIndex)
      if (registeredValue !== undefined) {
        return registeredValue // This is the most reliable source
      }

      // Fallback if not registered
      if (typeof tok === 'string') {
        return tok
      }

      // For objects not using EditableText or not yet registered
      if (typeof tok === 'object') {
        console.warn(
          `[getActualTextForToken] Token at index ${tokenIndex} is an object but has no registered EditableText value. Returning empty string.`,
          tok
        )
        return ''
      }
      return '' // Should not be reached if tok is string or object
    },
    [_getEditableTextValue]
  )

  const handleRemoveTokenOnKeyDownInternal = React.useCallback(
    (
      e: React.KeyboardEvent<HTMLDivElement>,
      selectAllState: SelectAllState
    ) => {
      // Track whether preventDefault has been called by any handler
      const originalPreventDefault = e.preventDefault.bind(e)
      let deletionHappened = false
      let preventDefaultCalledByOnCharInput = false

      e.preventDefault = () => {
        deletionHappened = true
        originalPreventDefault()
      }

      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      console.log('[KeydownHandler] handleRemoveTokenOnKeyDownInternal ENTRY', {
        key: e.key,
        selectAllState
      })

      // Flag to track if onCharInput prevented the default action
      let wasHandledByOnCharInput = false

      // If onCharInput is provided, let's give it a chance to handle this first
      if (onCharInput) {
        let tokenHandleForContext: TokenHandle<T> | null = null
        const currentActiveTokenElement = activeTokenRef.current

        // Setup token handle for the active token if available
        if (
          currentActiveTokenElement &&
          currentActiveTokenElement.hasAttribute('data-token-id')
        ) {
          const activeTokenId = parseInt(
            currentActiveTokenElement.getAttribute('data-token-id')!
          )
          const currentTokenValueFromState = tokens[activeTokenId]

          let currentTextInDOM = ''
          if (currentActiveTokenElement) {
            const editableRegion = currentActiveTokenElement.querySelector(
              '[data-inlay-editable-region="true"]'
            )
            if (editableRegion) {
              const regionText = editableRegion.textContent || ''
              currentTextInDOM = regionText === ZWS ? '' : regionText
            } else {
              const tokenText = currentActiveTokenElement.textContent || ''
              currentTextInDOM = tokenText === ZWS ? '' : tokenText
            }
          }

          const isEditable =
            currentActiveTokenElement.getAttribute('data-token-editable') ===
            'true'
          let cursorOffsetInToken = 0
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
              if (
                range.startContainer.textContent === ZWS &&
                currentTextInDOM === '' &&
                cursorOffsetInToken === 1
              ) {
                cursorOffsetInToken = 0
              }
            } else if (range.startContainer === currentActiveTokenElement) {
              if (
                savedCursorRef.current &&
                savedCursorRef.current.index === activeTokenId
              ) {
                cursorOffsetInToken = savedCursorRef.current.offset
              } else {
                cursorOffsetInToken =
                  range.startOffset === 0 ? 0 : currentTextInDOM.length
              }
            }
          } else if (
            savedCursorRef.current &&
            savedCursorRef.current.index === activeTokenId
          ) {
            cursorOffsetInToken = savedCursorRef.current.offset
          }
          cursorOffsetInToken = Math.max(
            0,
            Math.min(cursorOffsetInToken, currentTextInDOM.length)
          )

          // Use a mutable snapshot so that update() can change what commit/split see
          let liveTextSnapshot = currentTextInDOM

          tokenHandleForContext = {
            value: currentTokenValueFromState,
            index: activeTokenId,
            get text() {
              return liveTextSnapshot
            },
            cursorOffset: cursorOffsetInToken,
            isEditable,
            update: (newText, newCursorOffset) => {
              if (!isEditable) return
              const newTokenValue = parseToken(newText)
              if (newTokenValue !== null) {
                setTokens((prev) => {
                  const updated = [...prev]
                  updated[activeTokenId] = newTokenValue
                  return updated
                })
                const finalOffset = newCursorOffset ?? newText.length
                savedCursorRef.current = {
                  index: activeTokenId,
                  offset: finalOffset
                }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setCaretState(savedCursorRef.current)

                // Update live snapshot so subsequent commit/split use the new text
                liveTextSnapshot = newText
                preventDefaultCalledByOnCharInput = true
              }
            },
            split: (options) => {
              if (
                !isEditable ||
                cursorOffsetInToken === 0 ||
                cursorOffsetInToken === liveTextSnapshot.length
              )
                return
              const textForFirstPart = liveTextSnapshot.substring(
                0,
                cursorOffsetInToken
              )
              const parsedFirstPart = parseToken(textForFirstPart)
              const parsedSecondPart = parseToken(options.textForSecondPart)
              if (parsedFirstPart !== null && parsedSecondPart !== null) {
                const newTokens = [...tokens]
                newTokens[activeTokenId] = parsedFirstPart
                newTokens.splice(activeTokenId + 1, 0, parsedSecondPart)
                const newSpacerCharsList = [...spacerChars]
                newSpacerCharsList[activeTokenId] =
                  options.spacerChar !== undefined
                    ? options.spacerChar
                    : insertSpacerOnCommit
                      ? e.key
                      : null
                newSpacerCharsList.splice(activeTokenId + 1, 0, null)
                while (newSpacerCharsList.length < newTokens.length)
                  newSpacerCharsList.push(null)
                if (newSpacerCharsList.length > newTokens.length)
                  newSpacerCharsList.length = newTokens.length
                setTokens(newTokens)
                setSpacerChars(newSpacerCharsList)
                savedCursorRef.current = { index: activeTokenId + 1, offset: 0 }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setCaretState(savedCursorRef.current)
                preventDefaultCalledByOnCharInput = true
              }
            },
            commit: (options) => {
              if (!isEditable) return
              const committedValue = parseToken(liveTextSnapshot)
              if (committedValue === null) return
              const newTokens = [...tokens]
              newTokens[activeTokenId] = committedValue
              newTokens.splice(activeTokenId + 1, 0, options.valueForNewToken)
              const newSpacerCharsList = [...spacerChars]
              newSpacerCharsList[activeTokenId] =
                options.spacerChar !== undefined
                  ? options.spacerChar
                  : insertSpacerOnCommit
                    ? e.key
                    : null
              newSpacerCharsList.splice(activeTokenId + 1, 0, null)
              setTokens(newTokens)
              setSpacerChars(newSpacerCharsList)

              // Determine the offset for the new token
              let newCursorOffset = 0
              const newActualTokenValue = options.valueForNewToken

              // If options.valueForNewToken is a string (e.g. "!" from the story)
              // its length is the offset.
              if (typeof newActualTokenValue === 'string') {
                newCursorOffset = newActualTokenValue.length
              } else if (
                newActualTokenValue &&
                typeof newActualTokenValue === 'object'
              ) {
                // If options.valueForNewToken is an object (the actual token type T)
                // then get its text representation's length for the offset.
                // Note: getActualTextForToken is used here. If the token is brand new and not yet in DOM
                // for _getEditableTextValue to pick up, this might default to its basic string form or empty.
                // For the story's case: `token.commit({ valueForNewToken: key, ... })` where key is '!',
                // options.valueForNewToken will be '!', so the string path is taken.
                const textOfNewToken = getActualTextForToken(
                  newActualTokenValue,
                  activeTokenId + 1
                )
                newCursorOffset = textOfNewToken.length
              }

              savedCursorRef.current = {
                index: activeTokenId + 1,
                offset: newCursorOffset
              }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              setCaretState(savedCursorRef.current)
              preventDefaultCalledByOnCharInput = true
            },
            remove: () => {
              if (!isEditable && tokens.length === 1 && activeTokenId === 0) {
                /* Allow removing single non-editable */
              } else if (!isEditable) return
              removeToken(activeTokenId)
              preventDefaultCalledByOnCharInput = true
            }
          }
        }

        const globalActionsForContext: OnInputGlobalActions<T> = {
          preventDefault: () => {
            preventDefaultCalledByOnCharInput = true
          },
          parse: parseToken,
          insert: (index, tokenValue, options) => {
            setTokens((prev) => {
              const newTokens = [...prev]
              newTokens.splice(index, 0, tokenValue)
              return newTokens
            })
            setSpacerChars((prevSpacers) => {
              const newSpacers = [...prevSpacers]
              if (index > 0 && options?.spacerCharForPrevious !== undefined) {
                if (index - 1 < newSpacers.length)
                  newSpacers[index - 1] = options.spacerCharForPrevious
                else {
                  while (newSpacers.length < index - 1) newSpacers.push(null)
                  newSpacers[index - 1] = options.spacerCharForPrevious
                }
              }
              newSpacers.splice(index, 0, null)
              return newSpacers
            })
            let cursorOffset = 0
            if (options?.cursorAt === 'end')
              cursorOffset = String(tokenValue ?? '').length
            else if (typeof options?.cursorAt === 'object')
              cursorOffset = options.cursorAt.offset
            savedCursorRef.current = { index, offset: cursorOffset }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)
            preventDefaultCalledByOnCharInput = true
          },
          removeAt: (indexToRemove) => {
            removeToken(indexToRemove)
            preventDefaultCalledByOnCharInput = true
          },
          replaceAll: (newTokens, newCursor, newSpacers) => {
            setTokens(newTokens)
            if (newSpacers) setSpacerChars(newSpacers)
            else setSpacerChars(Array(newTokens.length).fill(null))
            savedCursorRef.current = newCursor
            programmaticCursorExpectationRef.current = newCursor
            setCaretState(newCursor)
            preventDefaultCalledByOnCharInput = true
          },
          focus: (tokenIndex: number, caretOffset: number) => {
            // Move browser focus to the inlay root if it does not currently own focus
            if (
              mainDivRef.current &&
              document.activeElement !== mainDivRef.current
            ) {
              try {
                mainDivRef.current.focus({ preventScroll: true })
              } catch {
                // Ignore focus errors (e.g. if element is not focusable yet)
              }
            }

            // Clamp values just in case
            const safeIndex = Math.max(
              0,
              Math.min(tokenIndex, tokens.length - 1)
            )
            const safeOffset = Math.max(0, caretOffset)

            savedCursorRef.current = { index: safeIndex, offset: safeOffset }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)

            // Ensure the next layout effect tries to restore immediately
            forceImmediateRestoreRef.current = true

            // Update logical focus state for consumers
            onTokenFocus?.(safeIndex)

            // Immediately attempt to restore cursor now that we've set refs.
            if (mainDivRef.current) {
              restoreCursor({ index: safeIndex, offset: safeOffset })

              // Also ensure activeTokenRef points at the element
              const tokenEl = mainDivRef.current.querySelector(
                `[data-token-id="${safeIndex}"]`
              ) as HTMLElement | null
              if (tokenEl) {
                activeTokenRef.current = tokenEl
              }
            }

            preventDefaultCalledByOnCharInput = true
          }
        }

        const contextForOnCharInput: OnInputContext<T> = {
          key: e.key,
          tokens: [...tokens],
          token: tokenHandleForContext,
          actions: globalActionsForContext
        }

        // Call onCharInput with the context
        onCharInput(contextForOnCharInput)

        // Check if onCharInput prevented default or called any actions
        if (preventDefaultCalledByOnCharInput) {
          e.preventDefault() // Ensure e.preventDefault is called
          wasHandledByOnCharInput = true
          console.log(
            '[KeydownHandler] Delete/Backspace handled by onCharInput'
          )

          if (deletionHappened) {
            lastOperationTypeRef.current = 'delete'
          }
          return // Skip the default handling
        }
      }

      // If onCharInput didn't handle it, continue with the default handling
      if (!wasHandledByOnCharInput) {
        // Handle cross-token selection deletion first
        if (
          typeof selectAllState === 'object' &&
          selectAllState.type === 'cross-token'
        ) {
          console.log(
            '[KeydownHandler] Cross-token deletion triggered',
            selectAllState
          )
          e.preventDefault()
          const { startTokenIndex, startOffset, endTokenIndex, endOffset } =
            selectAllState
          console.log('[KeydownHandler] Cross-token details:', {
            startTokenIndex,
            startOffset,
            endTokenIndex,
            endOffset
          })

          const currentTokensForLog = [...tokens] // Log a snapshot
          console.log(
            '[KeydownHandler] Current tokens state (snapshot):',
            JSON.stringify(currentTokensForLog)
          )
          console.log(
            '[KeydownHandler] Current spacerChars state (snapshot):',
            JSON.stringify(spacerChars)
          )

          const startTokenValue =
            startTokenIndex < tokens.length
              ? tokens[startTokenIndex]
              : undefined
          const endTokenValue =
            endTokenIndex < tokens.length ? tokens[endTokenIndex] : undefined
          console.log('[KeydownHandler] Raw start/end token values:', {
            startTokenValue,
            endTokenValue
          })

          const textFromStartToken =
            startTokenIndex < tokens.length
              ? getActualTextForToken(tokens[startTokenIndex], startTokenIndex)
              : ''
          const textFromEndToken =
            endTokenIndex < tokens.length
              ? getActualTextForToken(tokens[endTokenIndex], endTokenIndex)
              : ''
          console.log('[KeydownHandler] Text from getActualTextForToken:', {
            textFromStartToken,
            textFromEndToken
          })

          const textBeforeSelection =
            startTokenIndex < tokens.length
              ? textFromStartToken.slice(0, startOffset)
              : ''
          const textAfterSelection =
            endTokenIndex < tokens.length
              ? textFromEndToken.slice(endOffset)
              : ''
          console.log('[KeydownHandler] Sliced text:', {
            textBeforeSelection,
            textAfterSelection
          })

          const mergedText = textBeforeSelection + textAfterSelection
          console.log('[KeydownHandler] Merged text for parsing:', mergedText)
          const newParsedToken = parseToken(mergedText)
          console.log('[KeydownHandler] Parsed new token:', newParsedToken)

          const newTokens: T[] = []
          const newSpacerCharsInternal: (string | null)[] = []

          console.log(
            '[KeydownHandler] Processing tokens BEFORE selection start (up to index',
            startTokenIndex - 1,
            '):'
          )
          // Add tokens before the selection
          for (let i = 0; i < startTokenIndex; i++) {
            if (i < tokens.length) {
              newTokens.push(tokens[i])
              newSpacerCharsInternal.push(
                i < spacerChars.length ? spacerChars[i] : null
              )
              console.log(
                `[KeydownHandler] Loop BEFORE: Added token ${i}:`,
                tokens[i],
                'Spacer:',
                spacerChars[i]
              )
            }
          }

          let cursorIndexAfterDelete = startTokenIndex
          let cursorOffsetAfterDelete = textBeforeSelection.length
          console.log('[KeydownHandler] Initial cursor intent:', {
            cursorIndexAfterDelete,
            cursorOffsetAfterDelete
          })

          if (newParsedToken !== null) {
            newTokens.push(newParsedToken)
            const spacerForNewToken =
              endTokenIndex < spacerChars.length
                ? spacerChars[endTokenIndex]
                : null
            newSpacerCharsInternal.push(spacerForNewToken)
            console.log(
              '[KeydownHandler] newParsedToken is NOT null. Added to newTokens. Chosen spacer:',
              spacerForNewToken,
              'New cursor intent (remains based on textBeforeSelection for now):',
              { cursorIndexAfterDelete, cursorOffsetAfterDelete }
            )
          } else {
            console.log('[KeydownHandler] newParsedToken IS null.')
            // No new token formed (e.g. mergedText was empty and parseToken returned null)
            // The cursor should effectively be at the end of content before selection start.
            // If startTokenIndex is 0 and textBeforeSelection is empty, newTokens might be empty.
            // If newTokens is not empty, cursor can be at end of last token before selection point.
            if (newTokens.length > 0) {
              cursorIndexAfterDelete = newTokens.length - 1
              cursorOffsetAfterDelete = getActualTextForToken(
                newTokens[newTokens.length - 1],
                newTokens.length - 1
              ).length
              console.log(
                '[KeydownHandler] newParsedToken null, newTokens has content. Cursor to end of last pre-selection token:',
                { cursorIndexAfterDelete, cursorOffsetAfterDelete }
              )
            } else {
              // All content up to selection start was deleted, and nothing new formed.
              // This implies the Inlay becomes empty or cursor is at start of what was after selection.
              cursorIndexAfterDelete = 0 // Will be adjusted if tokens from after selection are added
              cursorOffsetAfterDelete = 0
              console.log(
                '[KeydownHandler] newParsedToken null, newTokens empty. Cursor to 0,0 (may adjust):',
                { cursorIndexAfterDelete, cursorOffsetAfterDelete }
              )
            }
          }

          // Add tokens after the selection
          const firstIndexAfterSelection = newTokens.length
          console.log(
            '[KeydownHandler] Processing tokens AFTER selection end (from index',
            endTokenIndex + 1,
            'onwards). firstIndexAfterSelection for cursor adjustment:',
            firstIndexAfterSelection
          )
          for (let i = endTokenIndex + 1; i < tokens.length; i++) {
            newTokens.push(tokens[i])
            newSpacerCharsInternal.push(
              i < spacerChars.length ? spacerChars[i] : null
            )
            console.log(
              `[KeydownHandler] Loop AFTER: Added token ${i} (original index):`,
              tokens[i],
              'Spacer:',
              spacerChars[i]
            )
          }

          if (
            newParsedToken === null &&
            newTokens.length > 0 &&
            firstIndexAfterSelection < newTokens.length
          ) {
            // If no new token was formed from merge, and tokens from after the selection were added,
            // place cursor at the start of the first of those tokens.
            cursorIndexAfterDelete = firstIndexAfterSelection
            cursorOffsetAfterDelete = 0
            console.log(
              '[KeydownHandler] Cursor ADJUSTED (no new token, post-selection tokens exist):',
              { cursorIndexAfterDelete, cursorOffsetAfterDelete }
            )
          } else if (newParsedToken === null && newTokens.length === 0) {
            // Everything deleted, inlay is empty
            cursorIndexAfterDelete = 0
            cursorOffsetAfterDelete = 0
            console.log(
              '[KeydownHandler] Cursor for EMPTY Inlay (no new token, no post-selection tokens):',
              { cursorIndexAfterDelete, cursorOffsetAfterDelete }
            )
          }

          // Final check for cursor if newTokens is empty
          if (newTokens.length === 0) {
            savedCursorRef.current = null
            setCaretState(null)
            console.log(
              '[KeydownHandler] Final newTokens is empty. savedCursorRef.current = null'
            )
          } else {
            // Clamp cursorIndex to be within bounds of newTokens
            cursorIndexAfterDelete = Math.max(
              0,
              Math.min(cursorIndexAfterDelete, newTokens.length - 1)
            )
            savedCursorRef.current = {
              index: cursorIndexAfterDelete,
              offset: cursorOffsetAfterDelete
            }
            setCaretState(savedCursorRef.current)
            console.log(
              '[KeydownHandler] Final newTokens NOT empty. savedCursorRef.current:',
              savedCursorRef.current
            )
          }

          console.log(
            '[KeydownHandler] FINAL newTokens before setState:',
            JSON.stringify(newTokens)
          )
          console.log(
            '[KeydownHandler] FINAL newSpacerCharsInternal before setState:',
            JSON.stringify(newSpacerCharsInternal)
          )
          setTokens(newTokens)
          // Ensure spacerChars list has same length as newTokens, fill with null if necessary
          while (newSpacerCharsInternal.length < newTokens.length) {
            newSpacerCharsInternal.push(null)
          }
          if (newSpacerCharsInternal.length > newTokens.length) {
            newSpacerCharsInternal.length = newTokens.length
          }
          setSpacerChars(newSpacerCharsInternal)
          console.log(
            '[KeydownHandler] State updated. Final programmaticCursorExpectationRef:',
            savedCursorRef.current
          )

          programmaticCursorExpectationRef.current = savedCursorRef.current
          if (activeTokenRef.current) activeTokenRef.current = null
          onTokenFocus?.(null)
          selectAllStateRef.current = 'none' // Reset selectAllState
          console.log(
            '[KeydownHandler] Cross-token deletion COMPLETE. selectAllStateRef reset to none.'
          )

          if (deletionHappened) {
            lastOperationTypeRef.current = 'delete'
          }
          setCaretState(savedCursorRef.current)
          return
        }
        console.log(
          '[KeydownHandler] Did NOT enter cross-token deletion logic. selectAllState:',
          selectAllState
        )

        const currentSelection = window.getSelection()
        if (!currentSelection || currentSelection.rangeCount === 0) return

        const rangeForLog = currentSelection.getRangeAt(0)
        const localActiveTokenForLog = activeTokenRef.current
        const activeIndexForLog = localActiveTokenForLog?.getAttribute(
          'data-token-id'
        )
          ? parseInt(localActiveTokenForLog.getAttribute('data-token-id')!)
          : null

        let currentTextForLog = ''
        if (localActiveTokenForLog) {
          const editableRegion = localActiveTokenForLog.querySelector(
            '[data-inlay-editable-region="true"]'
          )
          if (editableRegion) {
            const regionText = editableRegion.textContent || ''
            currentTextForLog = regionText === ZWS ? '' : regionText
          } else {
            const tokenText = localActiveTokenForLog.textContent || ''
            currentTextForLog = tokenText === ZWS ? '' : tokenText
          }
        }

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
            const activeTokenIdStr =
              localActiveToken.getAttribute('data-token-id')
            if (!activeTokenIdStr) return
            const activeIndex = parseInt(activeTokenIdStr)

            console.log(
              '[handleRemoveTokenOnKeyDown] selectAllState=token: Clearing content of token',
              activeIndex
            )

            const newTokenValue = parseToken('')
            // Check if the spacer is null and if it is, remove the token instead of keeping an empty one
            // BUT keep the token if it's the only one in the inlay (tokens.length === 1)
            const hasNonNullSpacer =
              activeIndex < spacerChars.length &&
              (spacerChars[activeIndex] !== null ||
                (activeIndex > 0 && spacerChars[activeIndex - 1] !== null))
            const isOnlyToken = tokens.length === 1 && activeIndex === 0

            if (newTokenValue !== null && (hasNonNullSpacer || isOnlyToken)) {
              setTokens((prevTokens) => {
                const updatedTokens = [...prevTokens]
                updatedTokens[activeIndex] = newTokenValue
                return updatedTokens
              })
              savedCursorRef.current = { index: activeIndex, offset: 0 }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              setCaretState(savedCursorRef.current)
            } else {
              removeToken(activeIndex)
            }
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
          setCaretState(null)
          return
        }

        const range = currentSelection.getRangeAt(0)
        const { startContainer, startOffset, endOffset } = range
        const isCollapsed = range.collapsed

        const localActiveToken = activeTokenRef.current

        if (
          localActiveToken &&
          localActiveToken.getAttribute('data-token-editable') === 'true' &&
          localActiveToken.contains(startContainer) // Check if selection is within the token
        ) {
          const activeIndex = parseInt(
            localActiveToken.getAttribute('data-token-id')!
          )

          // currentText is already derived correctly for logging purposes (currentTextForLog)
          // Let's use a similar derivation for the actual text we'll be modifying.
          let currentText = ''
          const editableRegionNode = localActiveToken.querySelector(
            '[data-inlay-editable-region="true"]'
          )
          if (editableRegionNode) {
            const regionText = editableRegionNode.textContent || ''
            currentText = regionText === ZWS ? '' : regionText
          } else {
            // Simple token
            const tokenText = localActiveToken.textContent || ''
            currentText = tokenText === ZWS ? '' : tokenText
          }

          // Determine if the selection's startContainer is the primary text node we are manipulating
          let isCursorInPrimaryTextNode = false
          let effectiveStartOffset = startOffset

          if (
            editableRegionNode &&
            editableRegionNode.firstChild &&
            editableRegionNode.firstChild.nodeType === Node.TEXT_NODE
          ) {
            if (startContainer === editableRegionNode.firstChild) {
              isCursorInPrimaryTextNode = true
            } else if (
              startContainer === editableRegionNode &&
              currentText.length > 0
            ) {
              // Selection is on the EditableText span itself, not its text node.
              // If it's collapsed, and we have saved cursor, use that. Otherwise, could be start/end.
              if (
                isCollapsed &&
                savedCursorRef.current?.index === activeIndex
              ) {
                effectiveStartOffset = savedCursorRef.current.offset
                isCursorInPrimaryTextNode = true // Assume saved cursor is valid
              } else if (isCollapsed) {
                // Guess: if cursor is on the span, and it's backspace, assume end; if delete, assume start.
                // This is heuristic. A cleaner way is to ensure focus always lands inside the text node.
                effectiveStartOffset =
                  e.key === 'Backspace' ? currentText.length : 0
                isCursorInPrimaryTextNode = true
              }
            }
          } else if (
            !editableRegionNode &&
            localActiveToken.firstChild &&
            localActiveToken.firstChild.nodeType === Node.TEXT_NODE
          ) {
            // Simple token
            if (startContainer === localActiveToken.firstChild) {
              isCursorInPrimaryTextNode = true
            } else if (
              startContainer === localActiveToken &&
              currentText.length > 0
            ) {
              // Selection on the token span itself (simple token)
              if (
                isCollapsed &&
                savedCursorRef.current?.index === activeIndex
              ) {
                effectiveStartOffset = savedCursorRef.current.offset
                isCursorInPrimaryTextNode = true
              } else if (isCollapsed) {
                effectiveStartOffset =
                  e.key === 'Backspace' ? currentText.length : 0
                isCursorInPrimaryTextNode = true
              }
            }
          }

          // If the token is effectively empty (shows ZWS, currentText is ''), treat cursor at offset 0 as being in primary text node
          if (
            !isCursorInPrimaryTextNode &&
            currentText === '' &&
            startOffset === 0 &&
            startContainer === localActiveToken
          ) {
            isCursorInPrimaryTextNode = true
            effectiveStartOffset = 0
          }

          if (isCursorInPrimaryTextNode) {
            e.preventDefault() // CRITICAL: Prevent default if we're handling deletion within the primary text.

            let newText = currentText
            let newCursorOffset = effectiveStartOffset

            // Clamp effectiveStartOffset just in case
            effectiveStartOffset = Math.max(
              0,
              Math.min(effectiveStartOffset, currentText.length)
            )
            newCursorOffset = effectiveStartOffset

            if (isCollapsed) {
              if (e.key === 'Backspace') {
                if (effectiveStartOffset === 0) {
                  // Attempt to merge with the previous token.
                  // The merge logic itself calls e.preventDefault() and handles state updates if successful.
                  // It will return from handleRemoveTokenOnKeyDownInternal if merge happens.
                  // If no merge (e.g., first token), current e.preventDefault() stands, and no text change here.
                  if (activeIndex > 0) {
                    // The existing merge logic will be hit if we let it fall through,
                    // but we need to ensure it's called correctly.
                    // For now, let the original merge logic path handle this by NOT returning early.
                    // The original backspace-at-start merge logic:
                    const prevTokenIndex = activeIndex - 1
                    const prevTokenValue = tokens[prevTokenIndex]
                    const currentTokenValueForMerge = tokens[activeIndex] // currentText comes from DOM, might differ from state
                    const prevTokenTextForMerge = getActualTextForToken(
                      prevTokenValue,
                      prevTokenIndex
                    )
                    const currentTokenTextForActualMerge =
                      getActualTextForToken(
                        currentTokenValueForMerge,
                        activeIndex
                      )

                    // Check if the token being removed/merged is empty
                    if (
                      currentTokenTextForActualMerge === '' &&
                      forceImmediateRestoreRef
                    ) {
                      forceImmediateRestoreRef.current = true
                    }

                    const mergedText =
                      prevTokenTextForMerge + currentTokenTextForActualMerge
                    const newParsedMergedToken = parseToken(mergedText)

                    if (newParsedMergedToken !== null) {
                      const newTokensState = [...tokens]
                      newTokensState[prevTokenIndex] = newParsedMergedToken
                      newTokensState.splice(activeIndex, 1)
                      const newSpacerCharsState = [...spacerChars]
                      newSpacerCharsState.splice(prevTokenIndex, 1) // Remove spacer between merged tokens
                      setTokens(newTokensState)
                      setSpacerChars(newSpacerCharsState)
                      savedCursorRef.current = {
                        index: prevTokenIndex,
                        offset: prevTokenTextForMerge.length
                      }
                      programmaticCursorExpectationRef.current =
                        savedCursorRef.current
                      setCaretState(savedCursorRef.current)

                      // If the merged token was the active one, clear active state
                      if (
                        activeTokenRef.current &&
                        activeTokenRef.current.getAttribute('data-token-id') ===
                          activeIndex.toString()
                      ) {
                        activeTokenRef.current = null
                        onTokenFocus?.(null)
                      }
                      return // Merge handled
                    }
                    // If merge fails, it's like backspace at start of first token - no-op here.
                  }
                  // If not merged (first token, or parseToken failed), no change to newText/newCursorOffset yet.
                  // e.preventDefault() has been called. This is a no-op for text change.
                } else {
                  newText =
                    currentText.slice(0, effectiveStartOffset - 1) +
                    currentText.slice(effectiveStartOffset)
                  newCursorOffset = effectiveStartOffset - 1
                }
              } else if (e.key === 'Delete') {
                if (effectiveStartOffset === currentText.length) {
                  // Attempt to merge with the next token.
                  if (activeIndex < tokens.length - 1) {
                    const nextTokenIndex = activeIndex + 1
                    const currentTokenValueForMerge = tokens[activeIndex] // Use state value
                    const nextTokenValue = tokens[nextTokenIndex]
                    const currentTokenTextForActualMerge =
                      getActualTextForToken(
                        currentTokenValueForMerge,
                        activeIndex
                      )
                    const nextTokenTextForMerge = getActualTextForToken(
                      nextTokenValue,
                      nextTokenIndex
                    )

                    // Check if the token being removed/merged is empty
                    if (
                      currentTokenTextForActualMerge === '' &&
                      forceImmediateRestoreRef
                    ) {
                      forceImmediateRestoreRef.current = true
                    }

                    const mergedText =
                      currentTokenTextForActualMerge + nextTokenTextForMerge
                    const newParsedMergedToken = parseToken(mergedText)

                    if (newParsedMergedToken !== null) {
                      const newTokensState = [...tokens]
                      newTokensState[activeIndex] = newParsedMergedToken
                      newTokensState.splice(nextTokenIndex, 1)
                      const newSpacerCharsState = [...spacerChars]
                      newSpacerCharsState.splice(activeIndex, 1) // Remove spacer between merged tokens
                      setTokens(newTokensState)
                      setSpacerChars(newSpacerCharsState)
                      savedCursorRef.current = {
                        index: activeIndex,
                        offset: currentTokenTextForActualMerge.length
                      }
                      programmaticCursorExpectationRef.current =
                        savedCursorRef.current
                      setCaretState(savedCursorRef.current)

                      // If the token that was merged into (and thus effectively the one where deletion occurred at its end)
                      // is the active one, and the NEXT one was removed. The active token remains, but its content changed.
                      // No need to nullify activeTokenRef here, as it's still token 'activeIndex'.
                      // However, if focus was somehow on nextTokenIndex (though unlikely for Delete at end of current),
                      // that would be a different case. For now, assume activeIndex is the focus.
                      // The key is that token activeIndex *remains*.

                      // Consider if onTokenFocus needs to be called if the *content* of the active token changes.
                      // For now, assuming focus remains on activeIndex.
                      return // Merge handled
                    }
                  }
                  // If not merged (last token, or parseToken failed), no change.
                } else {
                  newText =
                    currentText.slice(0, effectiveStartOffset) +
                    currentText.slice(effectiveStartOffset + 1)
                  newCursorOffset = effectiveStartOffset
                }
              }
            } else {
              // Range deletion
              // Calculate end offset relative to currentText
              // This is a simplification. True end offset in complex selections can be tricky.
              let effectiveEndOffset =
                effectiveStartOffset + (endOffset - startOffset)

              effectiveEndOffset = Math.max(
                effectiveStartOffset,
                Math.min(effectiveEndOffset, currentText.length)
              )

              newText =
                currentText.slice(0, effectiveStartOffset) +
                currentText.slice(effectiveEndOffset)
              newCursorOffset = effectiveStartOffset
            }

            // Only proceed if text was actually changed by the intra-token logic, or if it was a boundary condition that didn't merge
            if (
              newText !== currentText ||
              (e.key === 'Backspace' &&
                effectiveStartOffset === 0 &&
                activeIndex === 0 &&
                currentText.length > 0 &&
                newText !== currentText) || // Backspace at very start of content made a change
              (e.key === 'Delete' &&
                effectiveStartOffset === currentText.length &&
                activeIndex === tokens.length - 1 &&
                currentText.length > 0 &&
                newText !== currentText) // Delete at very end of content made a change
            ) {
              const newTokenValue = parseToken(newText)
              // Check if we are dealing with a potentially empty token
              const isEmpty = newText === ''
              const hasNonNullSpacer =
                activeIndex < spacerChars.length &&
                (spacerChars[activeIndex] !== null ||
                  (activeIndex > 0 && spacerChars[activeIndex - 1] !== null))
              const isOnlyToken = tokens.length === 1 && activeIndex === 0

              if (
                newTokenValue !== null &&
                !(isEmpty && !hasNonNullSpacer && !isOnlyToken)
              ) {
                setTokens((prevTokens) => {
                  const updatedTokens = [...prevTokens]
                  if (activeIndex >= 0 && activeIndex < updatedTokens.length) {
                    updatedTokens[activeIndex] = newTokenValue
                  }
                  return updatedTokens
                })
                savedCursorRef.current = {
                  index: activeIndex,
                  offset: newCursorOffset
                }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setCaretState(savedCursorRef.current)
              } else {
                removeToken(activeIndex)
              }
            }
            return // Intra-token modification handled (or determined to be no-op after pD)
          }
        } // End of editable token, selection inside check

        // Logic for non-editable tokens or boundary conditions for editable ones:
        if (
          localActiveToken &&
          localActiveToken.getAttribute('data-token-editable') === 'false'
        ) {
          console.log(
            'handleRemoveTokenOnKeyDown: non-editable token deletion',
            localActiveToken.dataset.tokenId
          )
          e.preventDefault()
          saveCursor() // Save cursor before removing
          const tokenIndexToRemove = localActiveToken.getAttribute(
            'data-token-id'
          )
            ? parseInt(localActiveToken.getAttribute('data-token-id')!)
            : -1 // Should always exist here
          if (tokenIndexToRemove !== -1) removeToken(tokenIndexToRemove)
          return
        }

        // Boundary deletion (removing a whole token when at start/end of it)
        let tokenElToRemove: HTMLElement | null = null
        if (e.key === 'Backspace' && startOffset === 0 && isCollapsed) {
          if (
            localActiveToken &&
            (startContainer === localActiveToken ||
              startContainer.parentElement === localActiveToken)
          ) {
            // If Backspace at start of current *active* token, this case is handled by merge logic or falls through.
            // The original code had a `tokenElToRemove = localActiveToken` path here, but that might be redundant
            // if merge logic above already handled it or if we want native behavior for first token.
            // For now, let merge logic or later specific boundary logic for deletion of first token handle this.
          } else {
            // Selection is not directly on the active token, but at start of some node.
            // Try to find previous sibling if it's a token.
            const currentElement =
              startContainer.nodeType === Node.TEXT_NODE
                ? startContainer.parentElement
                : (startContainer as Element)
            const prevSibling = currentElement?.previousElementSibling
            if (prevSibling && prevSibling.hasAttribute('data-token-id')) {
              tokenElToRemove = prevSibling as HTMLElement //This implies deleting previous non-editable token
            }
          }
        }

        if (e.key === 'Delete' && localActiveToken && isCollapsed) {
          const textLen = (
            localActiveToken.textContent === ZWS
              ? ''
              : localActiveToken.textContent || ''
          ).length
          if (
            startOffset === textLen &&
            (startContainer === localActiveToken ||
              startContainer.parentElement === localActiveToken)
          ) {
            // If Delete at the end of current *active* token, this is handled by merge logic with next token.
            // The original code had a complex sibling check here. For now, handled by merge logic
            // or default behavior for last token. What if it is a non-editable token?
            const nextSibling = localActiveToken.nextElementSibling
            if (
              nextSibling &&
              nextSibling.hasAttribute('data-token-id') &&
              nextSibling.getAttribute('data-token-editable') === 'false'
            ) {
              tokenElToRemove = nextSibling as HTMLElement // Delete next non-editable token
            }
          }
        } else if (
          e.key === 'Delete' &&
          startContainer.nodeType === Node.TEXT_NODE &&
          isCollapsed
        ) {
          // This part is complex, handling delete when selection is not directly on token but in its text.
          // The original code had logic to find parent and then next sibling.
          // For simplicity, if merge didn't handle it, and it's not a non-editable token, let it be.
        }

        if (
          tokenElToRemove &&
          tokenElToRemove.getAttribute('data-token-editable') === 'false'
        ) {
          const tokenId = tokenElToRemove.getAttribute('data-token-id')
          if (tokenId) {
            e.preventDefault()
            removeToken(parseInt(tokenId))
            // Cursor setting after removing non-editable token might need specific logic here.
            // For now, removeToken will try to set it to an adjacent token or null.
          }
          return
        }

        if (deletionHappened) {
          lastOperationTypeRef.current = 'delete'
        }
      }
    },
    [
      tokens,
      setTokens,
      spacerChars,
      setSpacerChars,
      activeTokenRef,
      savedCursorRef,
      programmaticCursorExpectationRef,
      parseToken,
      removeToken,
      onTokenFocus,
      saveCursor,
      restoreCursor,
      forceImmediateRestoreRef,
      lastOperationTypeRef,
      setCaretState
    ]
  )

  const onKeydownHandler = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let preventDefaultCalledByOnCharInput = false

      // Arrow key handling to update caret position
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        activeTokenRef.current
      ) {
        const activeTokenId =
          activeTokenRef.current.getAttribute('data-token-id')
        if (activeTokenId) {
          const activeIndex = parseInt(activeTokenId)
          const selection = window.getSelection()

          if (selection && selection.rangeCount > 0) {
            // Just let the default behavior happen, but capture the new position on next tick
            setTimeout(() => {
              const newSelection = window.getSelection()
              if (newSelection && newSelection.rangeCount > 0) {
                const newRange = newSelection.getRangeAt(0)
                const newOffset = newRange.startOffset

                // Only update if we're still in the same token
                if (
                  activeTokenRef.current?.getAttribute('data-token-id') ===
                  activeTokenId
                ) {
                  savedCursorRef.current = {
                    index: activeIndex,
                    offset: newOffset
                  }
                  setCaretState(savedCursorRef.current)
                }
              }
            }, 0)
          }
        }
      }

      // --- UNDO/REDO LOGIC --- START ---
      const isUndo =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
      const isRedo =
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z'

      if (isUndo) {
        e.preventDefault()
        if (DEBUG_HISTORY)
          console.log(
            '[KeydownHandler] UNDO triggered. Can undo:',
            history.canUndo
          )
        if (history.canUndo) {
          isRestoringHistoryRef.current = true
          if (DEBUG_HISTORY)
            console.log(
              '[KeydownHandler] UNDO: isRestoringHistoryRef set to true'
            )
          const restored = history.undo()
          if (DEBUG_HISTORY)
            console.log(
              '[KeydownHandler] UNDO: history.undo() returned:',
              restored ? JSON.parse(JSON.stringify(restored)) : null
            )
          if (restored) {
            setTokens(restored.tokens as T[])
            setSpacerChars(restored.spacerChars as (string | null)[])
            setCaretState(restored.caretState as CaretPosition | null)
            selectAllStateRef.current = restored.selectAllState

            savedCursorRef.current = restored.caretState
            programmaticCursorExpectationRef.current = restored.caretState
            forceImmediateRestoreRef.current = true
            if (DEBUG_HISTORY)
              console.log(
                '[KeydownHandler] UNDO: Applied restored state. forceImmediateRestoreRef set to true.'
              )

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                isRestoringHistoryRef.current = false
                if (DEBUG_HISTORY)
                  console.log(
                    '[KeydownHandler] UNDO: isRestoringHistoryRef set to false (after rAFs)'
                  )
              })
            })
          }
        } else {
          isRestoringHistoryRef.current = false
        }
        return
      }

      if (isRedo) {
        e.preventDefault()
        if (DEBUG_HISTORY)
          console.log(
            '[KeydownHandler] REDO triggered. Can redo:',
            history.canRedo
          )
        if (history.canRedo) {
          isRestoringHistoryRef.current = true
          if (DEBUG_HISTORY)
            console.log(
              '[KeydownHandler] REDO: isRestoringHistoryRef set to true'
            )
          const restored = history.redo()
          if (DEBUG_HISTORY)
            console.log(
              '[KeydownHandler] REDO: history.redo() returned:',
              restored ? JSON.parse(JSON.stringify(restored)) : null
            )
          if (restored) {
            setTokens(restored.tokens as T[])
            setSpacerChars(restored.spacerChars as (string | null)[])
            setCaretState(restored.caretState as CaretPosition | null)
            selectAllStateRef.current = restored.selectAllState

            savedCursorRef.current = restored.caretState
            programmaticCursorExpectationRef.current = restored.caretState
            forceImmediateRestoreRef.current = true
            if (DEBUG_HISTORY)
              console.log(
                '[KeydownHandler] REDO: Applied restored state. forceImmediateRestoreRef set to true.'
              )

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                isRestoringHistoryRef.current = false
                if (DEBUG_HISTORY)
                  console.log(
                    '[KeydownHandler] REDO: isRestoringHistoryRef set to false (after rAFs)'
                  )
              })
            })
          }
        } else {
          isRestoringHistoryRef.current = false
        }
        return
      }
      // --- UNDO/REDO LOGIC --- END ---

      // --- SHIFT+ENTER FOR MULTILINE --- START ---
      if (multiline && e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        lastOperationTypeRef.current = 'typing' // Or a new type like 'insertLineBreak'

        const activeTokenElement = activeTokenRef.current
        if (
          activeTokenElement &&
          activeTokenElement.getAttribute('data-token-editable') === 'true'
        ) {
          const activeIndex = parseInt(
            activeTokenElement.getAttribute('data-token-id')!
          )

          let currentTokenText = ''
          const editableRegion = activeTokenElement.querySelector(
            '[data-inlay-editable-region="true"]'
          )
          if (editableRegion) {
            const regionText = editableRegion.textContent || ''
            currentTokenText = regionText === ZWS ? '' : regionText
          } else {
            const tokenText = activeTokenElement.textContent || ''
            currentTokenText = tokenText === ZWS ? '' : tokenText
          }

          let cursorOffsetInToken = 0
          const selection = window.getSelection()

          // Try to get offset from DOM selection first
          if (
            selection &&
            selection.rangeCount > 0 &&
            activeTokenElement.contains(selection.anchorNode)
          ) {
            const range = selection.getRangeAt(0)
            const editableRegionNode = activeTokenElement.querySelector(
              '[data-inlay-editable-region="true"]'
            )

            if (editableRegionNode) {
              // EditableText case
              if (editableRegionNode.contains(range.startContainer)) {
                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                  // Caret is in a text node within the editable region
                  // We need to sum up lengths of preceding sibling text nodes within editableRegionNode
                  let tempOffset = 0
                  let currentNode = editableRegionNode.firstChild
                  while (currentNode && currentNode !== range.startContainer) {
                    if (currentNode.nodeType === Node.TEXT_NODE) {
                      tempOffset += (currentNode.textContent || '').length
                    }
                    // Potential: Handle element nodes within editable region if they can exist and affect offset
                    currentNode = currentNode.nextSibling
                  }
                  if (currentNode === range.startContainer) {
                    // Found the text node
                    tempOffset += range.startOffset
                  } else {
                    // Fallback if startContainer is not a direct child text node sequence (e.g. nested spans)
                    // This might happen if a more complex structure is inside editableRegionNode.
                    // A robust way would be to create a temporary range from start of editableRegionNode to selection start.
                    // For now, using range.startOffset relative to its container if it's not a simple text sequence.
                    console.warn(
                      '[Shift+Enter] Complex node structure in editable region, offset might be approximate.'
                    )
                    tempOffset = range.startOffset
                  }
                  cursorOffsetInToken = tempOffset
                } else if (range.startContainer === editableRegionNode) {
                  // Caret is on the editable region span itself
                  if (
                    savedCursorRef.current &&
                    savedCursorRef.current.index === activeIndex
                  ) {
                    cursorOffsetInToken = savedCursorRef.current.offset
                  } else {
                    let currentTextLength = 0
                    const regionText = editableRegionNode.textContent || ''
                    currentTextLength =
                      regionText === ZWS ? 0 : regionText.length
                    // If range.startOffset is 0, it's start; otherwise, could be end or child index.
                    // We rely on currentTokenText for max length later.
                    cursorOffsetInToken =
                      range.startOffset === 0 ? 0 : currentTextLength
                  }
                }
              } else if (range.startContainer === activeTokenElement) {
                // Selection is on the token element itself, but there's an editable region.
                if (
                  savedCursorRef.current &&
                  savedCursorRef.current.index === activeIndex
                ) {
                  cursorOffsetInToken = savedCursorRef.current.offset
                } else {
                  let currentTextLength = 0
                  const regionText = editableRegionNode.textContent || ''
                  currentTextLength = regionText === ZWS ? 0 : regionText.length
                  cursorOffsetInToken = currentTextLength // Default to end of content within editable region
                }
              } else {
                // Selection anchor is within activeTokenElement but not editableRegionNode or activeTokenElement itself.
                // This is an unusual case. Fallback to savedCursorRef.
                if (
                  savedCursorRef.current &&
                  savedCursorRef.current.index === activeIndex
                ) {
                  cursorOffsetInToken = savedCursorRef.current.offset
                }
              }
            } else {
              // Simple token case (no editable region)
              if (
                range.startContainer.nodeType === Node.TEXT_NODE &&
                activeTokenElement.contains(range.startContainer)
              ) {
                // Ensure the text node is a direct child or we sum offsets if it's nested simply
                let tempOffset = 0
                const parentIsActiveToken =
                  range.startContainer.parentElement === activeTokenElement
                if (parentIsActiveToken) {
                  tempOffset = range.startOffset
                } else {
                  // Handle cases where text node might be wrapped in simple, non-functional spans inside the token
                  let current = range.startContainer
                  let accumulatedOffset = range.startOffset
                  while (
                    current &&
                    current !== activeTokenElement &&
                    current.parentElement !== activeTokenElement
                  ) {
                    let sibling = current.previousSibling
                    while (sibling) {
                      accumulatedOffset += (sibling.textContent || '').length
                      sibling = sibling.previousSibling
                    }
                    current = current.parentElement
                  }
                  tempOffset = accumulatedOffset
                }
                cursorOffsetInToken = tempOffset
              } else if (range.startContainer === activeTokenElement) {
                if (
                  savedCursorRef.current &&
                  savedCursorRef.current.index === activeIndex
                ) {
                  cursorOffsetInToken = savedCursorRef.current.offset
                } else {
                  cursorOffsetInToken =
                    range.startOffset === 0 ? 0 : currentTokenText.length
                }
              }
            }

            // ZWS correction for empty editable text (applied after specific calculations)
            if (currentTokenText === '' && cursorOffsetInToken === 1) {
              // If the effective text is empty, and raw offset (e.g. from ZWS) is 1, treat as 0.
              const rawTextContent = editableRegionNode
                ? editableRegionNode.textContent
                : activeTokenElement.textContent
              if (rawTextContent === ZWS) {
                cursorOffsetInToken = 0
              }
            }
          } else if (
            savedCursorRef.current &&
            savedCursorRef.current.index === activeIndex
          ) {
            // Fallback to savedCursorRef if DOM selection is not usable, not within the token, or not available
            cursorOffsetInToken = savedCursorRef.current.offset
          }

          // Final clamping
          cursorOffsetInToken = Math.max(
            0,
            Math.min(cursorOffsetInToken, currentTokenText.length)
          )

          const textBeforeCursor = currentTokenText.substring(
            0,
            cursorOffsetInToken
          )
          const textAfterCursor =
            currentTokenText.substring(cursorOffsetInToken)

          const parsedTokenBefore = parseToken(textBeforeCursor)
          const parsedTokenAfter = parseToken(textAfterCursor)

          if (parsedTokenBefore !== null && parsedTokenAfter !== null) {
            const newTokens = [...tokens]
            newTokens[activeIndex] = parsedTokenBefore
            newTokens.splice(activeIndex + 1, 0, parsedTokenAfter)

            const newSpacerCharsList = [...spacerChars]
            // Ensure spacer list is long enough
            while (newSpacerCharsList.length < activeIndex) {
              newSpacerCharsList.push(null)
            }
            const originalSpacerAfterCurrentToken =
              newSpacerCharsList[activeIndex]
            newSpacerCharsList[activeIndex] = '\n' // Newline spacer after the first part
            // Insert the original spacer (or null) after the second part
            newSpacerCharsList.splice(
              activeIndex + 1,
              0,
              originalSpacerAfterCurrentToken ?? null
            )

            // Adjust length if originalSpacerAfterCurrentToken was undefined and activeIndex was last
            while (
              newSpacerCharsList.length < newTokens.length - 1 &&
              newTokens.length > 1
            ) {
              newSpacerCharsList.push(null)
            }
            if (
              newSpacerCharsList.length > newTokens.length - 1 &&
              newTokens.length > 0
            ) {
              newSpacerCharsList.length = Math.max(0, newTokens.length - 1)
            }

            setTokens(newTokens)
            setSpacerChars(newSpacerCharsList)

            savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)
            forceImmediateRestoreRef.current = true
          }
        } else if (tokens.length === 0) {
          // Inlay is empty, create two tokens with a newline spacer
          const firstToken = parseToken('')
          const secondToken = parseToken('')
          if (firstToken !== null && secondToken !== null) {
            setTokens([firstToken, secondToken])
            setSpacerChars(['\n'])
            savedCursorRef.current = { index: 1, offset: 0 }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)
            forceImmediateRestoreRef.current = true
          }
        } else {
          // No active editable token, try to append a newline and new token at the end
          const lastTokenIndex = tokens.length - 1
          const newEmptyToken = parseToken('')
          if (newEmptyToken !== null) {
            const newTokens = [...tokens, newEmptyToken]
            const newSpacerCharsList = [...spacerChars]
            while (newSpacerCharsList.length < lastTokenIndex) {
              newSpacerCharsList.push(null)
            }
            newSpacerCharsList[lastTokenIndex] = '\n'
            // Ensure spacer list matches new token structure
            while (
              newSpacerCharsList.length < newTokens.length - 1 &&
              newTokens.length > 1
            ) {
              newSpacerCharsList.push(null)
            }
            if (
              newSpacerCharsList.length > newTokens.length - 1 &&
              newTokens.length > 0
            ) {
              newSpacerCharsList.length = Math.max(0, newTokens.length - 1)
            }

            setTokens(newTokens)
            setSpacerChars(newSpacerCharsList)
            savedCursorRef.current = { index: tokens.length, offset: 0 } // cursor on the new empty token
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)
            forceImmediateRestoreRef.current = true
          }
        }
        return
      }
      // --- SHIFT+ENTER FOR MULTILINE --- END ---

      if (
        onCharInput &&
        (e.key.length === 1 ||
          e.key === 'Enter' ||
          e.key === 'Backspace' ||
          e.key === 'Delete')
      ) {
        let tokenHandleForContext: TokenHandle<T> | null = null
        const currentActiveTokenElement = activeTokenRef.current

        if (
          currentActiveTokenElement &&
          currentActiveTokenElement.hasAttribute('data-token-id')
        ) {
          const activeIndex = parseInt(
            currentActiveTokenElement.getAttribute('data-token-id')!
          )
          const currentTokenValueFromState = tokens[activeIndex]

          let currentTextInDOM = ''
          if (currentActiveTokenElement) {
            const editableRegion = currentActiveTokenElement.querySelector(
              '[data-inlay-editable-region="true"]'
            )
            if (editableRegion) {
              const regionText = editableRegion.textContent || ''
              currentTextInDOM = regionText === ZWS ? '' : regionText
            } else {
              const tokenText = currentActiveTokenElement.textContent || ''
              currentTextInDOM = tokenText === ZWS ? '' : tokenText
            }
          }

          const isEditable =
            currentActiveTokenElement.getAttribute('data-token-editable') ===
            'true'
          let cursorOffsetInToken = 0
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
              if (
                range.startContainer.textContent === ZWS &&
                currentTextInDOM === '' &&
                cursorOffsetInToken === 1
              ) {
                cursorOffsetInToken = 0
              }
            } else if (range.startContainer === currentActiveTokenElement) {
              if (
                savedCursorRef.current &&
                savedCursorRef.current.index === activeIndex
              ) {
                cursorOffsetInToken = savedCursorRef.current.offset
              } else {
                cursorOffsetInToken =
                  range.startOffset === 0 ? 0 : currentTextInDOM.length
              }
            }
          } else if (
            savedCursorRef.current &&
            savedCursorRef.current.index === activeIndex
          ) {
            cursorOffsetInToken = savedCursorRef.current.offset
          }
          cursorOffsetInToken = Math.max(
            0,
            Math.min(cursorOffsetInToken, currentTextInDOM.length)
          )

          // Use a mutable snapshot so that update() can change what commit/split see
          let liveTextSnapshot = currentTextInDOM

          tokenHandleForContext = {
            value: currentTokenValueFromState,
            index: activeIndex,
            get text() {
              return liveTextSnapshot
            },
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
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setCaretState(savedCursorRef.current)

                // Update live snapshot so subsequent commit/split use the new text
                liveTextSnapshot = newText
                preventDefaultCalledByOnCharInput = true
              }
            },
            split: (options) => {
              if (
                !isEditable ||
                cursorOffsetInToken === 0 ||
                cursorOffsetInToken === liveTextSnapshot.length
              )
                return
              const textForFirstPart = liveTextSnapshot.substring(
                0,
                cursorOffsetInToken
              )
              const parsedFirstPart = parseToken(textForFirstPart)
              const parsedSecondPart = parseToken(options.textForSecondPart)
              if (parsedFirstPart !== null && parsedSecondPart !== null) {
                const newTokens = [...tokens]
                newTokens[activeIndex] = parsedFirstPart
                newTokens.splice(activeIndex + 1, 0, parsedSecondPart)
                const newSpacerCharsList = [...spacerChars]
                newSpacerCharsList[activeIndex] =
                  options.spacerChar !== undefined
                    ? options.spacerChar
                    : insertSpacerOnCommit
                      ? e.key
                      : null
                newSpacerCharsList.splice(activeIndex + 1, 0, null)
                while (newSpacerCharsList.length < newTokens.length)
                  newSpacerCharsList.push(null)
                if (newSpacerCharsList.length > newTokens.length)
                  newSpacerCharsList.length = newTokens.length
                setTokens(newTokens)
                setSpacerChars(newSpacerCharsList)
                savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setCaretState(savedCursorRef.current)
                preventDefaultCalledByOnCharInput = true
              }
            },
            commit: (options) => {
              if (!isEditable) return
              const committedValue = parseToken(liveTextSnapshot)
              if (committedValue === null) return
              const newTokens = [...tokens]
              newTokens[activeIndex] = committedValue
              newTokens.splice(activeIndex + 1, 0, options.valueForNewToken)
              const newSpacerCharsList = [...spacerChars]
              newSpacerCharsList[activeIndex] =
                options.spacerChar !== undefined
                  ? options.spacerChar
                  : insertSpacerOnCommit
                    ? e.key
                    : null
              newSpacerCharsList.splice(activeIndex + 1, 0, null)
              setTokens(newTokens)
              setSpacerChars(newSpacerCharsList)

              // Determine the offset for the new token
              let newCursorOffset = 0
              const newActualTokenValue = options.valueForNewToken

              // If options.valueForNewToken is a string (e.g. "!" from the story)
              // its length is the offset.
              if (typeof newActualTokenValue === 'string') {
                newCursorOffset = newActualTokenValue.length
              } else if (
                newActualTokenValue &&
                typeof newActualTokenValue === 'object'
              ) {
                // If options.valueForNewToken is an object (the actual token type T)
                // then get its text representation's length for the offset.
                // Note: getActualTextForToken is used here. If the token is brand new and not yet in DOM
                // for _getEditableTextValue to pick up, this might default to its basic string form or empty.
                // For the story's case: `token.commit({ valueForNewToken: key, ... })` where key is '!',
                // options.valueForNewToken will be '!', so the string path is taken.
                const textOfNewToken = getActualTextForToken(
                  newActualTokenValue,
                  activeIndex + 1
                )
                newCursorOffset = textOfNewToken.length
              }

              savedCursorRef.current = {
                index: activeIndex + 1,
                offset: newCursorOffset
              }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              setCaretState(savedCursorRef.current)
              preventDefaultCalledByOnCharInput = true
            },
            remove: () => {
              if (!isEditable && tokens.length === 1 && activeIndex === 0) {
                /* Allow removing single non-editable */
              } else if (!isEditable) return
              removeToken(activeIndex)
              preventDefaultCalledByOnCharInput = true
            }
          }
        }

        const globalActionsForContext: OnInputGlobalActions<T> = {
          preventDefault: () => {
            preventDefaultCalledByOnCharInput = true
          },
          parse: parseToken,
          insert: (index, tokenValue, options) => {
            setTokens((prev) => {
              const newTokens = [...prev]
              newTokens.splice(index, 0, tokenValue)
              return newTokens
            })
            setSpacerChars((prevSpacers) => {
              const newSpacers = [...prevSpacers]
              if (index > 0 && options?.spacerCharForPrevious !== undefined) {
                if (index - 1 < newSpacers.length)
                  newSpacers[index - 1] = options.spacerCharForPrevious
                else {
                  while (newSpacers.length < index - 1) newSpacers.push(null)
                  newSpacers[index - 1] = options.spacerCharForPrevious
                }
              }
              newSpacers.splice(index, 0, null)
              return newSpacers
            })
            let cursorOffset = 0
            if (options?.cursorAt === 'end')
              cursorOffset = String(tokenValue ?? '').length
            else if (typeof options?.cursorAt === 'object')
              cursorOffset = options.cursorAt.offset
            savedCursorRef.current = { index, offset: cursorOffset }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)
            preventDefaultCalledByOnCharInput = true
          },
          removeAt: (indexToRemove) => {
            removeToken(indexToRemove)
            preventDefaultCalledByOnCharInput = true
          },
          replaceAll: (newTokens, newCursor, newSpacers) => {
            setTokens(newTokens)
            if (newSpacers) setSpacerChars(newSpacers)
            else setSpacerChars(Array(newTokens.length).fill(null))
            savedCursorRef.current = newCursor
            programmaticCursorExpectationRef.current = newCursor
            setCaretState(newCursor)
            preventDefaultCalledByOnCharInput = true
          },
          focus: (tokenIndex: number, caretOffset: number) => {
            // Move browser focus to the inlay root if it does not currently own focus
            if (
              mainDivRef.current &&
              document.activeElement !== mainDivRef.current
            ) {
              try {
                mainDivRef.current.focus({ preventScroll: true })
              } catch {
                // Ignore focus errors (e.g. if element is not focusable yet)
              }
            }

            // Clamp values just in case
            const safeIndex = Math.max(
              0,
              Math.min(tokenIndex, tokens.length - 1)
            )
            const safeOffset = Math.max(0, caretOffset)

            savedCursorRef.current = { index: safeIndex, offset: safeOffset }
            programmaticCursorExpectationRef.current = savedCursorRef.current
            setCaretState(savedCursorRef.current)

            // Ensure the next layout effect tries to restore immediately
            forceImmediateRestoreRef.current = true

            // Update logical focus state for consumers
            onTokenFocus?.(safeIndex)

            // Immediately attempt to restore cursor now that we've set refs.
            if (mainDivRef.current) {
              restoreCursor({ index: safeIndex, offset: safeOffset })

              // Also ensure activeTokenRef points at the element
              const tokenEl = mainDivRef.current.querySelector(
                `[data-token-id="${safeIndex}"]`
              ) as HTMLElement | null
              if (tokenEl) {
                activeTokenRef.current = tokenEl
              }
            }

            preventDefaultCalledByOnCharInput = true
          }
        }

        const contextForOnCharInput: OnInputContext<T> = {
          key: e.key,
          tokens: [...tokens],
          token: tokenHandleForContext,
          actions: globalActionsForContext
        }
        onCharInput(contextForOnCharInput)

        // Check if onCharInput prevented default or called any actions
        if (preventDefaultCalledByOnCharInput) {
          e.preventDefault() // Ensure e.preventDefault is called
          if (selectAllStateRef.current !== 'none')
            selectAllStateRef.current = 'none'
          return
        }
      }

      if (commitOnChars && commitOnChars.includes(e.key)) {
        if (
          activeTokenRef.current?.getAttribute('data-token-editable') === 'true'
        ) {
          lastOperationTypeRef.current = 'commit'
          e.preventDefault()
          const activeTokenElement = activeTokenRef.current
          const activeIndex = parseInt(
            activeTokenElement.getAttribute('data-token-id')!
          )
          let currentTokenText = ''
          if (activeTokenElement) {
            const editableRegion = activeTokenElement.querySelector(
              '[data-inlay-editable-region="true"]'
            )
            if (editableRegion) {
              const regionText = editableRegion.textContent || ''
              currentTokenText = regionText === ZWS ? '' : regionText
            } else {
              const tokenText = activeTokenElement.textContent || ''
              currentTokenText = tokenText === ZWS ? '' : tokenText
            }
          }
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
                )
                  charOffsetInToken = 0
              } else if (container === activeTokenElement) {
                charOffsetInToken =
                  savedCursorRef.current &&
                  savedCursorRef.current.index === activeIndex
                    ? savedCursorRef.current.offset
                    : offset === 0
                      ? 0
                      : currentTokenText.length
              } else {
                charOffsetInToken =
                  savedCursorRef.current &&
                  savedCursorRef.current.index === activeIndex
                    ? savedCursorRef.current.offset
                    : currentTokenText.length
              }
            }
          }
          if (charOffsetInToken < 0 && currentTokenText.length > 0)
            charOffsetInToken = currentTokenText.length
          else if (charOffsetInToken < 0) charOffsetInToken = 0
          if (charOffsetInToken > currentTokenText.length)
            charOffsetInToken = currentTokenText.length

          const canSplit =
            currentTokenText !== '' &&
            charOffsetInToken > 0 &&
            charOffsetInToken < currentTokenText.length
          if (canSplit) {
            const textBeforeSplit = currentTokenText.substring(
              0,
              charOffsetInToken
            )
            const textAfterSplit = currentTokenText.substring(charOffsetInToken)
            const token1 = parseToken(textBeforeSplit)
            const token2 = parseToken(textAfterSplit)
            if (token1 !== null && token2 !== null) {
              const newTokens = [...tokens]
              newTokens[activeIndex] = token1
              newTokens.splice(activeIndex + 1, 0, token2)
              const newSpacerCharsList = [...spacerChars]
              if (displayCommitCharSpacer)
                newSpacerCharsList[activeIndex] = e.key
              else newSpacerCharsList[activeIndex] = null
              newSpacerCharsList.splice(activeIndex + 1, 0, null)
              setTokens(newTokens)
              setSpacerChars(newSpacerCharsList)
              savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
              programmaticCursorExpectationRef.current = savedCursorRef.current
              return
            }
          }

          const committedValue = parseToken(currentTokenText)
          if (committedValue !== null) {
            const newTokens = [...tokens]
            newTokens[activeIndex] = committedValue
            let focusMovedToNewToken = false
            const newSpacerCharsList = [...spacerChars]
            if (addNewTokenOnCommit) {
              let valueForNewSlot: T | undefined | null = defaultNewTokenValue
              if (valueForNewSlot === undefined)
                valueForNewSlot = parseToken('')
              if (valueForNewSlot !== null) {
                newTokens.splice(activeIndex + 1, 0, valueForNewSlot)
                if (insertSpacerOnCommit)
                  newSpacerCharsList[activeIndex] = e.key
                else newSpacerCharsList[activeIndex] = null
                while (newSpacerCharsList.length <= activeIndex + 1)
                  newSpacerCharsList.push(null)
                newSpacerCharsList.splice(activeIndex + 1, 0, null)
                if (newSpacerCharsList.length > newTokens.length)
                  newSpacerCharsList.length = newTokens.length

                // Determine the offset for the new token
                let newCursorOffset = 0
                const newActualTokenValue = valueForNewSlot

                // If options.valueForNewToken is a string (e.g. "!" from the story)
                // its length is the offset.
                if (typeof newActualTokenValue === 'string') {
                  newCursorOffset = newActualTokenValue.length
                } else if (
                  newActualTokenValue &&
                  typeof newActualTokenValue === 'object'
                ) {
                  // If options.valueForNewToken is an object (the actual token type T)
                  // then get its text representation's length for the offset.
                  // Note: getActualTextForToken is used here. If the token is brand new and not yet in DOM
                  // for _getEditableTextValue to pick up, this might default to its basic string form or empty.
                  // For the story's case: `token.commit({ valueForNewToken: key, ... })` where key is '!',
                  // options.valueForNewToken will be '!', so the string path is taken.
                  const textOfNewToken = getActualTextForToken(
                    newActualTokenValue,
                    activeIndex + 1
                  )
                  newCursorOffset = textOfNewToken.length
                }

                savedCursorRef.current = {
                  index: activeIndex + 1,
                  offset: newCursorOffset
                }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                focusMovedToNewToken = true
              } else newSpacerCharsList[activeIndex] = null
            } else newSpacerCharsList[activeIndex] = null
            if (!focusMovedToNewToken) {
              savedCursorRef.current = {
                index: activeIndex,
                offset: String(committedValue ?? '').length
              }
              programmaticCursorExpectationRef.current = savedCursorRef.current
            }
            setSpacerChars(newSpacerCharsList)
            setTokens(newTokens)
          }
          return
        }
        if (e.key === 'Enter') e.preventDefault()
      }

      // Ctrl+A handling
      const isCtrlA = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'
      if (isCtrlA) {
        e.preventDefault()
        const localActiveToken = activeTokenRef.current
        const sel = window.getSelection()
        const isActiveTokenEffectivelyBlank =
          localActiveToken &&
          (!localActiveToken.textContent ||
            localActiveToken.textContent === ZWS)
        if (
          localActiveToken &&
          localActiveToken.getAttribute('data-token-editable') === 'true' &&
          !isActiveTokenEffectivelyBlank &&
          mainDivRef.current?.contains(localActiveToken) &&
          selectAllStateRef.current === 'none' &&
          sel
        ) {
          const range = document.createRange()
          range.selectNodeContents(localActiveToken)
          sel.removeAllRanges()
          sel.addRange(range)
          selectAllStateRef.current = 'token'
        } else if (sel && mainDivRef.current) {
          sel.removeAllRanges()
          const range = document.createRange()
          range.selectNodeContents(mainDivRef.current)
          sel.addRange(range)
          selectAllStateRef.current = 'all'
          if (activeTokenRef.current !== null) activeTokenRef.current = null
          savedCursorRef.current = null
        }
        return
      }

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
        if (selectAllStateRef.current !== 'none')
          selectAllStateRef.current = 'none'
      }

      // This is where handleRemoveTokenOnKeyDown was originally called in _Inlay's onKeyDown
      if (e.key === 'Backspace' || e.key === 'Delete') {
        handleRemoveTokenOnKeyDownInternal(e, selectAllStateBeforeKeyProcessing)
        if (
          selectAllStateBeforeKeyProcessing !== 'none' &&
          e.defaultPrevented
        ) {
          selectAllStateRef.current = 'none'
        }
      }
    },
    [
      // All dependencies for onKeyDown and handleRemoveTokenOnKeyDownInternal
      tokens,
      setTokens,
      spacerChars,
      setSpacerChars,
      activeTokenRef,
      savedCursorRef,
      programmaticCursorExpectationRef,
      mainDivRef,
      selectAllStateRef,
      parseToken,
      removeToken,
      saveCursor,
      restoreCursor,
      onTokenFocus,
      onCharInput,
      commitOnChars,
      defaultNewTokenValue,
      addNewTokenOnCommit,
      insertSpacerOnCommit,
      displayCommitCharSpacer,
      _getEditableTextValue,
      handleRemoveTokenOnKeyDownInternal,
      forceImmediateRestoreRef,
      // New props for history
      history, // Destructure
      isRestoringHistoryRef, // Destructure
      setCaretState, // Destructure
      lastOperationTypeRef,
      multiline // Add multiline to dependency array
    ]
  )

  return onKeydownHandler
}
