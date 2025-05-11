import * as React from 'react'
import { ZWS } from '../inlay.constants'
import { calculateOffsetInTextProvider } from '../utils/domNavigationUtils'
// We might need ScopedProps or other common types if we were to use context, but for now, direct props.

type UseBeforeInputHandlerProps<T> = {
  tokens: Readonly<T[]>
  activeTokenRef: React.RefObject<HTMLElement | null>
  parseToken: (value: string) => T | null
  setTokens: React.Dispatch<React.SetStateAction<T[]>>
  savedCursorRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
  mainDivRef: React.RefObject<HTMLDivElement | null>
  spacerChars: (string | null)[]
  setSpacerChars: React.Dispatch<React.SetStateAction<(string | null)[]>>
  programmaticCursorExpectationRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
}

export function useBeforeInputHandler<T>({
  tokens, // Renamed from currentTokens for clarity
  activeTokenRef, // Was localActiveTokenRef
  parseToken, // Was parseTokenFn
  setTokens, // Was setTokensFn
  savedCursorRef, // Was savedCursorRefObj
  mainDivRef, // Was ref
  spacerChars,
  setSpacerChars,
  programmaticCursorExpectationRef
}: UseBeforeInputHandlerProps<T>) {
  const onBeforeInputHandler = React.useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
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
        document.activeElement === mainDivRef.current
          ? 'main_div'
          : (document.activeElement as HTMLElement)?.getAttribute(
              'data-token-id'
            ) || document.activeElement,
        'localActiveTokenRef.current:', // This was the original name in the log
        activeTokenRef.current?.dataset.tokenId,
        'Target element of event:',
        (event.target as HTMLElement)?.dataset?.tokenId ||
          (
            (event.target as Node)?.parentElement?.closest?.(
              '[data-token-id]'
            ) as HTMLElement
          )?.dataset?.tokenId ||
          (event.target === mainDivRef.current ? 'main_div' : event.target)
      )

      const targetIsWithinActiveToken =
        activeTokenRef.current &&
        event.target &&
        activeTokenRef.current.contains(event.target as Node)

      if (
        activeTokenRef.current &&
        activeTokenRef.current.getAttribute('data-token-editable') === 'true' &&
        mainDivRef.current &&
        mainDivRef.current.contains(activeTokenRef.current) &&
        (document.activeElement === mainDivRef.current || // Focus might be on main div but logical token is active
          targetIsWithinActiveToken || // Event target is within the active token
          activeTokenRef.current.textContent === ZWS) // Active token is empty (ZWS)
      ) {
        const activeTokenElement = activeTokenRef.current
        const activeTokenId = activeTokenElement.getAttribute('data-token-id')
        if (!activeTokenId) return
        const activeIndex = parseInt(activeTokenId)

        if (isDeletion) {
          e.preventDefault() // Prevent browser's native deletion
          const selection = window.getSelection()
          if (!selection || selection.rangeCount === 0) return

          const range = selection.getRangeAt(0)

          let currentTextInToken = ''
          if (activeTokenElement) {
            const editableRegion = activeTokenElement.querySelector(
              '[data-inlay-editable-region="true"]'
            )
            if (editableRegion) {
              const regionText = editableRegion.textContent || ''
              currentTextInToken = regionText === ZWS ? '' : regionText
            } else {
              const tokenText = activeTokenElement.textContent || ''
              currentTextInToken = tokenText === ZWS ? '' : tokenText
            }
          }

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
                    const prevTokenForCursor = tokens[activeIndex - 1]
                    savedCursorRef.current = {
                      index: activeIndex - 1,
                      offset: String(prevTokenForCursor ?? '').length
                    }
                    programmaticCursorExpectationRef.current =
                      savedCursorRef.current
                    return // Spacer deletion handled
                  }

                  // TOKEN MERGE LOGIC
                  if (activeIndex > 0) {
                    const prevTokenValue = tokens[activeIndex - 1]
                    const currentTokenValue = tokens[activeIndex]
                    const currentTokenTextForMerge =
                      currentTokenValue === (ZWS as unknown as T) // Assuming T could be string and ZWS compared
                        ? ''
                        : String(currentTokenValue ?? '')
                    const prevTokenTextForMerge =
                      prevTokenValue === (ZWS as unknown as T)
                        ? ''
                        : String(prevTokenValue ?? '')
                    const mergedText =
                      prevTokenTextForMerge + currentTokenTextForMerge
                    const newParsedMergedToken = parseToken(mergedText)

                    if (newParsedMergedToken !== null) {
                      e.preventDefault()
                      const updatedTokens = [...tokens]
                      updatedTokens[activeIndex - 1] = newParsedMergedToken
                      const finalNewTokens = updatedTokens.filter(
                        (_, idx) => idx !== activeIndex
                      )
                      // When merging tokens[activeIndex-1] and tokens[activeIndex]
                      // the spacer to remove is spacerChars[activeIndex-1]
                      const finalNewSpacerChars = spacerChars.filter(
                        (_, idx) => idx !== activeIndex - 1
                      )

                      setTokens(finalNewTokens)
                      setSpacerChars(finalNewSpacerChars)

                      savedCursorRef.current = {
                        index: activeIndex - 1,
                        offset: prevTokenTextForMerge.length
                      }
                      programmaticCursorExpectationRef.current =
                        savedCursorRef.current
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
                  console.log(
                    '[_onBeforeInputHandler] Delete at end of text node. Letting onKeyDown handle.'
                  )
                  // CHECK FOR SPACER DELETION HERE
                  if (
                    activeIndex < tokens.length - 1 &&
                    spacerChars[activeIndex]
                  ) {
                    e.preventDefault()
                    const newSpacerChars = [...spacerChars]
                    newSpacerChars[activeIndex] = null
                    setSpacerChars(newSpacerChars)
                    savedCursorRef.current = {
                      index: activeIndex,
                      offset: String(tokens[activeIndex] ?? '').length
                    }
                    programmaticCursorExpectationRef.current =
                      savedCursorRef.current
                    return
                  }
                  return
                }
                // Original code had: currentTextInToken.slice(range.endOffset)
                // For collapsed range, startOffset === endOffset
                newTextForToken =
                  currentTextInToken.slice(0, range.startOffset) +
                  currentTextInToken.slice(range.startOffset + 1) // Corrected for single char delete
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
              // Non-collapsed range deletion (selection)
              e.preventDefault() // Ensure default is prevented for selection deletion too
              newTextForToken =
                currentTextInToken.slice(0, range.startOffset) +
                currentTextInToken.slice(range.endOffset)
              newCursorOffset = range.startOffset
            }

            // This block was outside the `if (range.collapsed)` but should be inside or after selection handling
            // Moved common logic for applying token update/removal here
            const newValueForToken = parseToken(newTextForToken)

            if (newValueForToken === null) {
              console.log(
                '[_onBeforeInputHandler] Token became null after deletion, removing token:',
                activeIndex
              )
              const newTokensResult = tokens.filter((_, i) => i !== activeIndex)
              setTokens(newTokensResult)
              // Adjust spacerChars when a token is removed
              const newSpacerCharsResult = [...spacerChars]
              newSpacerCharsResult.splice(activeIndex, 1) // Remove spacer at the deleted token's original position
              setSpacerChars(newSpacerCharsResult)

              if (newTokensResult.length === 0) {
                savedCursorRef.current = null
                programmaticCursorExpectationRef.current = null
              } else if (activeIndex >= newTokensResult.length) {
                const lastToken = newTokensResult[newTokensResult.length - 1]
                savedCursorRef.current = {
                  index: newTokensResult.length - 1,
                  offset: String(lastToken ?? '').length
                }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
              } else {
                savedCursorRef.current = { index: activeIndex, offset: 0 }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
              }
            } else {
              // Token updated
              const newTokensResult = [...tokens]
              if (activeIndex >= 0 && activeIndex < newTokensResult.length) {
                newTokensResult[activeIndex] = newValueForToken
                setTokens(newTokensResult)
                savedCursorRef.current = {
                  index: activeIndex,
                  offset: newCursorOffset
                }
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
              } else {
                console.error(
                  "[_onBeforeInputHandler] activeIndex out of bounds for deletion. This shouldn't happen."
                )
              }
            }
          } else {
            // Selection not directly on primary text node or complex
            console.warn(
              '[_onBeforeInputHandler] Deletion with complex selection or not in primary text node. Letting onKeyDown handle.'
            )
            return
          }
          return // Deletion handled or passed to onKeyDown
        } else if (event.data) {
          // --- CHARACTER INSERTION LOGIC MODIFICATION ---
          const charTyped = event.data
          e.preventDefault()

          let currentTextInToken = ''
          const editableRegion = activeTokenElement.querySelector(
            '[data-inlay-editable-region="true"]'
          ) as HTMLElement | null
          const textProviderForCalc = editableRegion || activeTokenElement

          if (editableRegion) {
            const regionText = editableRegion.textContent || ''
            currentTextInToken = regionText === ZWS ? '' : regionText
          } else {
            const tokenText = activeTokenElement.textContent || ''
            currentTextInToken = tokenText === ZWS ? '' : tokenText
          }

          let newTextForToken = ''
          let newCursorOffset = 0

          const selection = window.getSelection()

          if (
            selection &&
            selection.rangeCount > 0 &&
            activeTokenElement.contains(selection.anchorNode)
          ) {
            const range = selection.getRangeAt(0)
            if (
              !range.collapsed &&
              activeTokenElement.contains(range.endContainer)
            ) {
              // Non-collapsed selection within the token
              const selectionStartInTokenText = calculateOffsetInTextProvider(
                textProviderForCalc,
                range.startContainer,
                range.startOffset,
                selection.anchorNode,
                selection.anchorOffset
              )
              const selectionEndInTokenText = calculateOffsetInTextProvider(
                textProviderForCalc,
                range.endContainer,
                range.endOffset,
                selection.focusNode, // Use focusNode for the end of the range
                selection.focusOffset
              )

              console.log(
                `[_onBeforeInputHandler] Replacing selection: ${selectionStartInTokenText}-${selectionEndInTokenText} with '${charTyped}'`
              )
              newTextForToken =
                currentTextInToken.slice(0, selectionStartInTokenText) +
                charTyped +
                currentTextInToken.slice(selectionEndInTokenText)
              newCursorOffset = selectionStartInTokenText + charTyped.length
            } else {
              // Collapsed selection or selection not fully in token (treat as collapsed at start for safety)
              let originalInsertionOffset = calculateOffsetInTextProvider(
                textProviderForCalc,
                range.startContainer, // Use startContainer for collapsed
                range.startOffset,
                selection.anchorNode,
                selection.anchorOffset
              )
              // Fallback if calculateOffsetInTextProviderUtil had issues or selection was weird
              if (
                savedCursorRef.current &&
                savedCursorRef.current.index === activeIndex &&
                !(
                  selection.anchorNode &&
                  activeTokenElement.contains(selection.anchorNode)
                )
              ) {
                originalInsertionOffset = savedCursorRef.current.offset
              }
              originalInsertionOffset = Math.max(
                0,
                Math.min(originalInsertionOffset, currentTextInToken.length)
              )

              console.log(
                `[_onBeforeInputHandler] Collapsed insertion at: ${originalInsertionOffset} with '${charTyped}'`
              )
              newTextForToken =
                currentTextInToken.slice(0, originalInsertionOffset) +
                charTyped +
                currentTextInToken.slice(originalInsertionOffset)
              newCursorOffset = originalInsertionOffset + charTyped.length
            }
          } else {
            // Fallback if no selection or selection not in token, use saved cursor or end of token
            let fallbackOffset =
              savedCursorRef.current &&
              savedCursorRef.current.index === activeIndex
                ? savedCursorRef.current.offset
                : currentTextInToken.length
            fallbackOffset = Math.max(
              0,
              Math.min(fallbackOffset, currentTextInToken.length)
            )
            console.log(
              `[_onBeforeInputHandler] Fallback insertion at: ${fallbackOffset} with '${charTyped}'`
            )
            newTextForToken =
              currentTextInToken.slice(0, fallbackOffset) +
              charTyped +
              currentTextInToken.slice(fallbackOffset)
            newCursorOffset = fallbackOffset + charTyped.length
          }

          // ... (rest of existing logic: parseToken, setTokens, savedCursorRef, programmaticCursorExpectationRef)
          const newValueForToken = parseToken(newTextForToken)
          if (newValueForToken !== null) {
            const newTokensResult = [...tokens] // currentTokens is from props
            if (activeIndex >= 0 && activeIndex < newTokensResult.length) {
              newTokensResult[activeIndex] = newValueForToken
              setTokens(newTokensResult) // setTokensFn is from props
              savedCursorRef.current = {
                // savedCursorRefObj is from props
                index: activeIndex,
                offset: newCursorOffset
              }
              programmaticCursorExpectationRef.current = savedCursorRef.current
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
          return // Character insertion handled
        }
      } else if (
        event.data &&
        !activeTokenRef.current &&
        document.activeElement === mainDivRef.current
      ) {
        // Input is happening directly in the root contentEditable div
        e.preventDefault()
        const charTyped = event.data
        const textForNewToken = charTyped

        const newParsedToken = parseToken(textForNewToken)

        if (newParsedToken !== null) {
          const newTokensResult = [...tokens]
          newTokensResult.push(newParsedToken)
          setTokens(newTokensResult)
          // When adding a token to root, a new spacer slot is implicitly needed.
          // setSpacerChars should adjust based on tokens.length in _Inlay's useEffect,
          // or we might need to explicitly add a null spacer here if that effect isn't robust enough.
          // For now, assume the existing useEffect handles spacer list length.
          savedCursorRef.current = {
            index: newTokensResult.length - 1,
            offset: textForNewToken.length
          }
          programmaticCursorExpectationRef.current = savedCursorRef.current
          console.log(
            '[_onBeforeInputHandler] Handled root input. New token created:',
            JSON.stringify(newParsedToken),
            'New tokens:',
            JSON.stringify(newTokensResult)
          )
        } else {
          console.warn(
            '[_onBeforeInputHandler] Root input resulted in null token, input ignored. Text was:',
            textForNewToken
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
    },
    [
      tokens,
      activeTokenRef,
      parseToken,
      setTokens,
      savedCursorRef,
      mainDivRef,
      spacerChars,
      setSpacerChars,
      programmaticCursorExpectationRef
      // ZWS is a constant, not needed in dep array
    ]
  )

  return onBeforeInputHandler
}
