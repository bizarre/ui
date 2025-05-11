import * as React from 'react'
import type { InlayProps } from '../inlay.types'
import type { SelectAllState } from './useSelectionChangeHandler'
// import { ZWS } from '../inlay.constants'; // ZWS seems no longer used directly in this file
import { calculateOffsetInTextProvider } from '../utils/domNavigationUtils'

// Helper to get actual text, adapted from useCopyHandler or useKeydownHandler
function getActualTextForToken<T>(
  tok: T | undefined | null,
  tokenIndex: number,
  _getEditableTextValue: (index: number) => string | undefined
): string {
  if (tok === undefined || tok === null) return ''

  const registeredValue = _getEditableTextValue(tokenIndex)
  if (registeredValue !== undefined) {
    return registeredValue
  }

  if (typeof tok === 'string') {
    return tok
  }

  if (typeof tok === 'object') {
    // This is a placeholder. A more generic approach for object stringification might be needed.
    console.warn(
      `[getActualTextForToken (paste)] Token at index ${tokenIndex} is an object but has no registered EditableText value. Returning empty string.`,
      tok
    )
    return ''
  }
  return ''
}

interface ProcessedPastedData<T> {
  newTokens: T[]
  newSpacers: (string | null)[] // Spacers *between* the newTokens
}

/**
 * Processes a raw string of pasted text into tokens and spacers based on commit characters.
 */
function processPastedText<T>(
  pastedText: string,
  parseToken: (value: string) => T | null,
  commitOnChars: string[] | undefined,
  defaultNewTokenValue: T | undefined,
  addNewTokenOnCommit: boolean,
  insertSpacerOnCommit: boolean
  // displayCommitCharSpacer is not directly used here for spacer value, insertSpacerOnCommit dictates if spacer is commitChar
): ProcessedPastedData<T> {
  const newTokens: T[] = []
  const newSpacers: (string | null)[] = []
  let currentSegment = ''

  if (!commitOnChars || commitOnChars.length === 0) {
    // No commit characters, treat the whole pasted text as one token attempt
    const token = parseToken(pastedText)
    if (token !== null) {
      newTokens.push(token)
    }
    return { newTokens, newSpacers } // No spacers for a single (or zero) token result
  }

  for (let i = 0; i < pastedText.length; i++) {
    const char = pastedText[i]
    if (commitOnChars.includes(char)) {
      // Commit character found
      if (currentSegment !== '' || !addNewTokenOnCommit) {
        // Avoid empty token if segment is empty unless not adding new token
        const token = parseToken(currentSegment)
        if (token !== null) {
          newTokens.push(token)
          if (insertSpacerOnCommit) {
            // Spacer is added *after* this token, before the next one that might be created
            newSpacers.push(char)
          } else {
            newSpacers.push(null)
          }
        } else if (newTokens.length > 0) {
          // If current segment fails to parse but we have preceding tokens,
          // we still need a spacer if one was due.
          newSpacers.push(null)
        }
      }

      currentSegment = '' // Reset for next token

      if (addNewTokenOnCommit) {
        // If addNewTokenOnCommit is true, we conceptually start a new token immediately.
        // This new token might be based on defaultNewTokenValue or an empty parse.
        // The actual token value for this "new slot" isn't created here,
        // but the structure implies a new token slot follows.
        // The crucial part is that the commit char has caused a separation.
        // If defaultNewTokenValue is used and the next char is not a commit char,
        // it will be appended to this new token.
        // This logic primarily ensures correct token count and spacer placement.
        // We might need to push a default token if the pasted text ends here
        // or if we want to ensure an empty token is created.
        // For now, rely on the loop structure.
      }
    } else {
      currentSegment += char
    }
  }

  // Process the last segment
  if (currentSegment !== '') {
    const token = parseToken(currentSegment)
    if (token !== null) {
      newTokens.push(token)
      // No spacer after the very last token from pasted text
    }
  } else if (
    newTokens.length > 0 &&
    pastedText.length > 0 &&
    commitOnChars.includes(pastedText[pastedText.length - 1]) &&
    addNewTokenOnCommit
  ) {
    // If pasted text ends with a commit char and addNewTokenOnCommit is true,
    // a new empty token (or default) should be formed.
    const emptyToken =
      defaultNewTokenValue !== undefined ? defaultNewTokenValue : parseToken('')
    if (emptyToken !== null) {
      newTokens.push(emptyToken)
    }
  }

  // Ensure newSpacers has one less element than newTokens
  if (newTokens.length > 0 && newSpacers.length >= newTokens.length) {
    newSpacers.length = newTokens.length - 1
  } else if (newTokens.length === 0) {
    newSpacers.length = 0
  }

  return { newTokens, newSpacers }
}

export interface UsePasteHandlerProps<T> {
  mainDivRef: React.RefObject<HTMLDivElement | null>
  tokens: Readonly<T[]>
  setTokens: React.Dispatch<React.SetStateAction<T[]>>
  spacerChars: (string | null)[]
  setSpacerChars: React.Dispatch<React.SetStateAction<(string | null)[]>>
  activeTokenRef: React.RefObject<HTMLElement | null>
  savedCursorRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
  programmaticCursorExpectationRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
  selectAllStateRef: React.MutableRefObject<SelectAllState>

  parseToken: (value: string) => T | null
  removeToken: (index: number) => void // Scoped version from _Inlay
  _getEditableTextValue: (index: number) => string | undefined
  onTokenFocus?: (index: number | null) => void
  saveCursor: () => void // From _Inlay

  // Props from InlayProps<T> for tokenization and commit logic
  commitOnChars?: string[]
  defaultNewTokenValue?: T
  addNewTokenOnCommit: boolean
  insertSpacerOnCommit: boolean
  displayCommitCharSpacer?: InlayProps<T>['displayCommitCharSpacer']
  forceImmediateRestoreRef: React.MutableRefObject<boolean>
}

export function usePasteHandler<T>(props: UsePasteHandlerProps<T>): void {
  const {
    mainDivRef,
    tokens,
    setTokens,
    spacerChars,
    setSpacerChars,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    parseToken,
    _getEditableTextValue,
    onTokenFocus,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    forceImmediateRestoreRef
  } = props

  React.useEffect(() => {
    const mainDiv = mainDivRef.current
    if (!mainDiv) return

    const handlePaste = (event: ClipboardEvent) => {
      if (
        !mainDivRef.current ||
        !event.target ||
        !mainDivRef.current.contains(event.target as Node)
      ) {
        // Paste originated outside the inlay component
        return
      }

      event.preventDefault()
      const pastedRawText = event.clipboardData?.getData('text/plain')
      if (!pastedRawText) {
        return
      }

      console.log(
        '[usePasteHandler] Pasted raw text:',
        JSON.stringify(pastedRawText)
      )

      const processedPaste = processPastedText(
        pastedRawText,
        parseToken,
        commitOnChars,
        defaultNewTokenValue,
        addNewTokenOnCommit,
        insertSpacerOnCommit
      )

      console.log(
        '[usePasteHandler] Processed paste:',
        JSON.stringify(processedPaste)
      )

      if (processedPaste.newTokens.length === 0 && pastedRawText !== '') {
        // Pasted text could not be parsed into any valid tokens, do nothing.
        // Or, if selection exists, delete selection? For now, no-op if no new tokens.
        console.log(
          '[usePasteHandler] Pasted text resulted in no valid tokens. Aborting.'
        )
        // If there was a selection, it should still be cleared by resetting selectAllStateRef
        if (selectAllStateRef.current !== 'none') {
          selectAllStateRef.current = 'none'
          // Potentially trigger a re-render or cursor restoration if needed after selection clear
          forceImmediateRestoreRef.current = true
        }
        return
      }

      let finalTokens: T[] = []
      let finalSpacers: (string | null)[] = []
      let finalCursorIndex: number = 0
      let finalCursorOffset: number = 0

      const currentSelectionState = selectAllStateRef.current

      if (
        currentSelectionState === 'all' ||
        (tokens.length === 0 && activeTokenRef.current === null)
      ) {
        // Scenario 1: Replace all content or pasting into empty inlay
        console.log('[usePasteHandler] Scenario: Replace All or Empty Inlay')
        finalTokens = processedPaste.newTokens
        finalSpacers = processedPaste.newSpacers
        if (finalTokens.length > 0) {
          finalCursorIndex = finalTokens.length - 1
          const lastPastedToken = finalTokens[finalTokens.length - 1]
          finalCursorOffset = getActualTextForToken(
            lastPastedToken,
            0,
            () => undefined
          ).length
        } else {
          finalCursorIndex = 0
          finalCursorOffset = 0
        }
      } else if (
        typeof currentSelectionState === 'object' &&
        currentSelectionState.type === 'cross-token'
      ) {
        // Scenario 2: Cross-token selection
        console.log(
          '[usePasteHandler] Scenario: Cross-Token Selection',
          currentSelectionState
        )
        const {
          startTokenIndex,
          startOffset: rawStartOffset,
          endTokenIndex,
          endOffset: rawEndOffset
        } = currentSelectionState

        const textBeforeSelection =
          startTokenIndex < tokens.length
            ? getActualTextForToken(
                tokens[startTokenIndex],
                startTokenIndex,
                _getEditableTextValue
              ).slice(0, rawStartOffset)
            : ''
        const textAfterSelection =
          endTokenIndex < tokens.length
            ? getActualTextForToken(
                tokens[endTokenIndex],
                endTokenIndex,
                _getEditableTextValue
              ).slice(rawEndOffset)
            : ''

        const combinedTextToReprocess =
          textBeforeSelection + pastedRawText + textAfterSelection
        console.log(
          '[usePasteHandler] Cross-Token: Combined text for reprocessing:',
          JSON.stringify(combinedTextToReprocess)
        )

        const reprocessed = processPastedText(
          combinedTextToReprocess,
          parseToken,
          commitOnChars,
          defaultNewTokenValue,
          addNewTokenOnCommit,
          insertSpacerOnCommit
        )
        console.log(
          '[usePasteHandler] Cross-Token: Reprocessed data:',
          JSON.stringify(reprocessed)
        )

        finalTokens = [
          ...tokens.slice(0, startTokenIndex),
          ...reprocessed.newTokens,
          ...tokens.slice(endTokenIndex + 1)
        ]

        const spacersBeforeOriginalDefinition = spacerChars.slice(
          0,
          startTokenIndex > 0 ? startTokenIndex - 1 : 0
        )
        const middleSpacers = reprocessed.newSpacers
        const spacersAfter = spacerChars.slice(endTokenIndex + 1)

        finalSpacers = []
        if (startTokenIndex > 0 && tokens[startTokenIndex - 1]) {
          // Check if there are tokens before the selection block
          finalSpacers.push(...spacersBeforeOriginalDefinition) // Use the calculated spacersBefore
          // Determine if a spacer is needed between the block before selection and the new middle block
          if (reprocessed.newTokens.length > 0) {
            finalSpacers.push(spacerChars[startTokenIndex - 1]) // The original spacer that was before the startToken of selection
          } else if (tokens.slice(endTokenIndex + 1).length > 0) {
            // Merging textBefore (from original tokens) and textAfter (from original tokens), middle is empty
            finalSpacers.push(spacerChars[startTokenIndex - 1])
          }
        }
        finalSpacers.push(...middleSpacers)

        if (
          reprocessed.newTokens.length > 0 &&
          tokens.slice(endTokenIndex + 1).length > 0
        ) {
          finalSpacers.push(spacerChars[endTokenIndex]) // Original spacer after the endToken of selection
        }
        finalSpacers.push(...spacersAfter)

        finalCursorIndex =
          startTokenIndex +
          (reprocessed.newTokens.length > 0
            ? reprocessed.newTokens.findIndex((t) =>
                getActualTextForToken(t, 0, () => undefined).startsWith(
                  textBeforeSelection
                )
              )
            : 0)
        if (reprocessed.newTokens.length > 0) {
          const firstNewTokenText = getActualTextForToken(
            reprocessed.newTokens[0],
            0,
            () => undefined
          )
          if (firstNewTokenText.startsWith(textBeforeSelection)) {
            finalCursorOffset =
              textBeforeSelection.length + pastedRawText.length
            // Clamp to the actual length of the token formed by textBeforeSelection + pastedRawText
            const targetTokenIndexInReprocessed = 0 // Assuming first token holds this merge
            const targetTokenText = getActualTextForToken(
              reprocessed.newTokens[targetTokenIndexInReprocessed],
              targetTokenIndexInReprocessed,
              () => undefined
            )
            finalCursorOffset = Math.min(
              finalCursorOffset,
              targetTokenText.length
            )
            finalCursorIndex = startTokenIndex + targetTokenIndexInReprocessed
          } else {
            // Pasted text completely replaced textBeforeSelection
            finalCursorIndex = startTokenIndex
            finalCursorOffset = pastedRawText.length
            // Clamp to the actual length of the first token from pastedRawText
            const targetTokenText = getActualTextForToken(
              reprocessed.newTokens[0],
              0,
              () => undefined
            )
            finalCursorOffset = Math.min(
              finalCursorOffset,
              targetTokenText.length
            )
          }
        } else {
          // Pasted text + merge resulted in no tokens for middle part (e.g. deleted all)
          finalCursorIndex = startTokenIndex
          finalCursorOffset = textBeforeSelection.length
        }
      } else {
        // Scenario 3: Collapsed cursor or selection within a single token (or no specific selection state)
        console.log(
          '[usePasteHandler] Scenario: Collapsed Cursor / Single Token Edit'
        )
        let targetIndex = -1
        let charOffset = 0

        const sel = window.getSelection()

        if (activeTokenRef.current && activeTokenRef.current.dataset.tokenId) {
          targetIndex = parseInt(activeTokenRef.current.dataset.tokenId, 10)
          const currentTokenElement = activeTokenRef.current
          // textBeforeCursor and textAfterCursor will be determined based on selection state
          let textBeforeCursor = ''
          let textAfterCursor = ''

          if (
            sel &&
            sel.rangeCount > 0 &&
            currentTokenElement.contains(sel.anchorNode)
          ) {
            const range = sel.getRangeAt(0)
            const domStartContainer = range.startContainer
            const domStartOffsetInContainer = range.startOffset
            const domEndContainer = range.endContainer
            const domEndOffsetInContainer = range.endOffset

            if (sel.isCollapsed) {
              charOffset = calculateOffsetInTextProvider(
                currentTokenElement,
                domStartContainer,
                domStartOffsetInContainer,
                sel.anchorNode,
                sel.anchorOffset
              )
              console.log(
                `[usePasteHandler] Collapsed paste: Derived charOffset ${charOffset} from DOM.`
              )
              const currentTokenText = getActualTextForToken(
                tokens[targetIndex],
                targetIndex,
                _getEditableTextValue
              )
              textBeforeCursor = currentTokenText.slice(0, charOffset)
              textAfterCursor = currentTokenText.slice(charOffset)
            } else {
              // Non-collapsed selection
              charOffset = calculateOffsetInTextProvider(
                currentTokenElement,
                domStartContainer,
                domStartOffsetInContainer,
                sel.anchorNode,
                sel.anchorOffset
              )
              const endCharOffset = calculateOffsetInTextProvider(
                currentTokenElement,
                domEndContainer,
                domEndOffsetInContainer,
                sel.focusNode,
                sel.focusOffset
              )
              console.log(
                `[usePasteHandler] Selection paste: charOffset=${charOffset}, endCharOffset=${endCharOffset}`
              )
              const currentTokenText = getActualTextForToken(
                tokens[targetIndex],
                targetIndex,
                _getEditableTextValue
              )
              textBeforeCursor = currentTokenText.slice(0, charOffset)
              textAfterCursor = currentTokenText.slice(endCharOffset)
            }
          } else if (
            savedCursorRef.current &&
            savedCursorRef.current.index === targetIndex
          ) {
            charOffset = savedCursorRef.current.offset
            console.log(
              `[usePasteHandler] Paste: Used savedCursorRef for charOffset: ${charOffset}`
            )
            const currentTokenText = getActualTextForToken(
              tokens[targetIndex],
              targetIndex,
              _getEditableTextValue
            )
            textBeforeCursor = currentTokenText.slice(0, charOffset)
            textAfterCursor = currentTokenText.slice(charOffset)
          } else {
            charOffset = getActualTextForToken(
              tokens[targetIndex],
              targetIndex,
              _getEditableTextValue
            ).length
            console.log(
              `[usePasteHandler] Paste: Fallback charOffset to end of token: ${charOffset}`
            )
            textBeforeCursor = getActualTextForToken(
              tokens[targetIndex],
              targetIndex,
              _getEditableTextValue
            )
            textAfterCursor = ''
          }

          console.log(
            `[usePasteHandler] Single Token Edit: targetIndex=${targetIndex}, effective charOffset for paste=${charOffset}`
          )
          console.log(
            `[usePasteHandler] textBeforeCursor="${textBeforeCursor}", textAfterCursor="${textAfterCursor}"`
          )

          const combinedTextToReprocess =
            textBeforeCursor + pastedRawText + textAfterCursor
          console.log(
            '[usePasteHandler] Single Token: Combined text for reprocessing:',
            JSON.stringify(combinedTextToReprocess)
          )
          const reprocessed = processPastedText(
            combinedTextToReprocess,
            parseToken,
            commitOnChars,
            defaultNewTokenValue,
            addNewTokenOnCommit,
            insertSpacerOnCommit
          )
          console.log(
            '[usePasteHandler] Single Token: Reprocessed data:',
            JSON.stringify(reprocessed)
          )

          finalTokens = [
            ...tokens.slice(0, targetIndex),
            ...reprocessed.newTokens,
            ...tokens.slice(targetIndex + 1)
          ]

          const spacersBeforeSingleTokenOriginalDef =
            targetIndex > 0 ? spacerChars.slice(0, targetIndex - 1) : []
          const middleSpacersSingleToken = reprocessed.newSpacers
          const spacersAfterSingleToken = spacerChars.slice(targetIndex + 1)

          finalSpacers = []
          if (targetIndex > 0 && tokens[targetIndex - 1]) {
            finalSpacers.push(...spacersBeforeSingleTokenOriginalDef)
            if (reprocessed.newTokens.length > 0) {
              finalSpacers.push(spacerChars[targetIndex - 1])
            } else if (tokens.slice(targetIndex + 1).length > 0) {
              finalSpacers.push(spacerChars[targetIndex - 1])
            }
          }
          finalSpacers.push(...middleSpacersSingleToken)

          if (
            reprocessed.newTokens.length > 0 &&
            tokens.slice(targetIndex + 1).length > 0
          ) {
            finalSpacers.push(spacerChars[targetIndex])
          }
          finalSpacers.push(...spacersAfterSingleToken)

          if (reprocessed.newTokens.length === 1) {
            finalCursorIndex = targetIndex
            finalCursorOffset = charOffset + pastedRawText.length
          } else if (reprocessed.newTokens.length > 1) {
            let lengthBeforePastedTextInReprocessed = textBeforeCursor.length
            let foundCursor = false
            for (let k = 0; k < reprocessed.newTokens.length; k++) {
              const currentReprocessedTokenText = getActualTextForToken(
                reprocessed.newTokens[k],
                k,
                () => undefined
              )
              if (
                !foundCursor &&
                lengthBeforePastedTextInReprocessed <
                  currentReprocessedTokenText.length
              ) {
                const remainingLengthInThisTokenForPasted =
                  currentReprocessedTokenText.length -
                  lengthBeforePastedTextInReprocessed
                if (
                  pastedRawText.length <= remainingLengthInThisTokenForPasted
                ) {
                  finalCursorIndex = targetIndex + k
                  finalCursorOffset =
                    lengthBeforePastedTextInReprocessed + pastedRawText.length
                  foundCursor = true
                  break
                } else {
                  lengthBeforePastedTextInReprocessed -=
                    currentReprocessedTokenText.length
                }
              }
              if (
                k < reprocessed.newSpacers.length &&
                reprocessed.newSpacers[k]
              ) {
                lengthBeforePastedTextInReprocessed -=
                  reprocessed.newSpacers[k]!.length
              }
            }
            if (!foundCursor) {
              finalCursorIndex = targetIndex + reprocessed.newTokens.length - 1
              finalCursorOffset = getActualTextForToken(
                reprocessed.newTokens[reprocessed.newTokens.length - 1],
                reprocessed.newTokens.length - 1,
                () => undefined
              ).length
            }
          } else {
            finalCursorIndex = targetIndex
            finalCursorOffset = charOffset
          }
        } else {
          console.log(
            '[usePasteHandler] Fallback: Appending to existing tokens'
          )
          finalTokens = [...tokens, ...processedPaste.newTokens]
          finalSpacers = [...spacerChars]
          if (
            tokens.length > 0 &&
            processedPaste.newTokens.length > 0 &&
            commitOnChars?.includes(' ') &&
            insertSpacerOnCommit
          ) {
            finalSpacers.push(' ')
          } else if (tokens.length > 0 && processedPaste.newTokens.length > 0) {
            finalSpacers.push(null)
          }
          finalSpacers.push(...processedPaste.newSpacers)
          finalCursorIndex = finalTokens.length - 1
          finalCursorOffset =
            finalTokens.length > 0
              ? getActualTextForToken(
                  finalTokens[finalCursorIndex],
                  finalCursorIndex,
                  () => undefined
                ).length
              : 0
        }
      }

      console.log(
        '[usePasteHandler] Final calculated tokens:',
        JSON.stringify(finalTokens)
      )
      if (finalTokens.length > 0) {
        while (finalSpacers.length >= finalTokens.length) {
          finalSpacers.pop()
        }
        while (finalSpacers.length < finalTokens.length - 1) {
          finalSpacers.push(null)
        }
      } else {
        finalSpacers = []
      }
      console.log(
        '[usePasteHandler] Final calculated spacers:',
        JSON.stringify(finalSpacers)
      )
      console.log(
        `[usePasteHandler] Final cursor: index=${finalCursorIndex}, offset=${finalCursorOffset}`
      )

      setTokens(finalTokens)
      setSpacerChars(finalSpacers)

      if (finalTokens.length === 0) {
        savedCursorRef.current = null
      } else {
        finalCursorIndex = Math.max(
          0,
          Math.min(finalCursorIndex, finalTokens.length - 1)
        )
        if (finalTokens[finalCursorIndex]) {
          const maxOffset = getActualTextForToken(
            finalTokens[finalCursorIndex],
            finalCursorIndex,
            () => undefined
          ).length
          finalCursorOffset = Math.max(
            0,
            Math.min(finalCursorOffset, maxOffset)
          )
        } else {
          finalCursorOffset = 0
        }
        savedCursorRef.current = {
          index: finalCursorIndex,
          offset: finalCursorOffset
        }
      }

      programmaticCursorExpectationRef.current = savedCursorRef.current
      selectAllStateRef.current = 'none'
      if (activeTokenRef.current) {
        const newActiveTokenStillExists = finalTokens.some(
          (_tok, idx) =>
            activeTokenRef.current?.dataset.tokenId === idx.toString()
        )
        if (!newActiveTokenStillExists && activeTokenRef.current) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        } else if (newActiveTokenStillExists && savedCursorRef.current) {
        }
      } else {
        onTokenFocus?.(
          savedCursorRef.current ? savedCursorRef.current.index : null
        )
      }

      forceImmediateRestoreRef.current = true
      console.log('[usePasteHandler] Paste handling COMPLETE.')
    }

    mainDiv.addEventListener('paste', handlePaste)
    return () => {
      mainDiv.removeEventListener('paste', handlePaste)
    }
  }, [
    mainDivRef,
    tokens,
    setTokens,
    spacerChars,
    setSpacerChars,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    parseToken,
    _getEditableTextValue,
    onTokenFocus,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    forceImmediateRestoreRef
  ])
}
