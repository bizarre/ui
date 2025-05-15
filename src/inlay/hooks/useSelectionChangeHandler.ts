import * as React from 'react'
import { ZWS } from '../inlay.constants'

export interface UseSelectionChangeHandlerProps {
  mainDivRef: React.RefObject<HTMLDivElement | null>
  activeTokenRef: React.MutableRefObject<HTMLElement | null>
  onTokenFocus?: (index: number | null) => void
  savedCursorRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
  programmaticCursorExpectationRef: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
  selectAllStateRef: React.MutableRefObject<SelectAllState>
  setCaretState?: React.Dispatch<
    React.SetStateAction<{
      index: number
      offset: number
    } | null>
  >
}

export type CrossTokenSelectionDetails = {
  type: 'cross-token'
  startTokenIndex: number
  startOffset: number
  endTokenIndex: number
  endOffset: number
}

export type SelectAllState =
  | 'none'
  | 'token'
  | 'all'
  | CrossTokenSelectionDetails

export function useSelectionChangeHandler(
  props: UseSelectionChangeHandlerProps
) {
  const {
    mainDivRef,
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    setCaretState
  } = props

  React.useEffect(() => {
    const getOffsetInToken = (
      tokenEl: HTMLElement,
      container: Node,
      offsetInContainer: number
    ): number => {
      // Ensure tokenEl is valid and has textContent
      if (!tokenEl || typeof tokenEl.textContent !== 'string') {
        console.warn('[getOffsetInToken] Invalid tokenEl or textContent.')
        return 0
      }
      const tokenTextContent = tokenEl.textContent

      if (
        tokenTextContent === ZWS &&
        tokenEl.getAttribute('data-token-editable') === 'true'
      ) {
        return 0
      }

      const editableRegion = tokenEl.querySelector(
        '[data-inlay-editable-region="true"]'
      ) as HTMLElement | null

      if (editableRegion) {
        const editableRegionText = editableRegion.textContent || ''
        if (
          container === editableRegion ||
          editableRegion.contains(container)
        ) {
          let relativeOffset = 0
          if (
            editableRegion.firstChild &&
            container.nodeType === Node.TEXT_NODE &&
            editableRegion.contains(container)
          ) {
            // Walk from editableRegion.firstChild to container, summing lengths
            let currentNode: Node | null = editableRegion.firstChild
            while (currentNode && currentNode !== container) {
              relativeOffset += (currentNode.textContent || '').length
              currentNode = currentNode.nextSibling
            }
            if (currentNode === container) {
              // container is found
              relativeOffset += offsetInContainer
            } else {
              // container not found as a direct descendant text node sequence - might be deeper or offsetInContainer is for the editableRegion itself
              relativeOffset = offsetInContainer
            }
          } else if (container === editableRegion) {
            relativeOffset = offsetInContainer
          } else {
            // Fallback if container is not a text node directly or the editableRegion itself
            // This could happen if there are other wrapper elements inside editableRegion.
            // A more robust way would be to create a temporary range.
            // For now, this is a simplification.
            relativeOffset = offsetInContainer
          }
          return Math.min(
            relativeOffset,
            editableRegionText.length === 1 && editableRegionText === ZWS
              ? 0
              : editableRegionText.length
          )
        }
        // Fallback if selection is somehow outside editable region but within token, use ZWS logic
        return editableRegionText === ZWS ? 0 : editableRegionText.length
      }

      // Simple token (no editable region)
      if (
        container.nodeType === Node.TEXT_NODE &&
        tokenEl.contains(container)
      ) {
        // Similar logic for simple tokens if they could have multiple text nodes (though less common for 'simple')
        let relativeOffset = 0
        let currentNode: Node | null = tokenEl.firstChild
        while (currentNode && currentNode !== container) {
          relativeOffset += (currentNode.textContent || '').length
          currentNode = currentNode.nextSibling
        }
        if (currentNode === container) {
          relativeOffset += offsetInContainer
        } else {
          relativeOffset = offsetInContainer
        }
        return Math.min(
          relativeOffset,
          tokenTextContent.length === 1 && tokenTextContent === ZWS
            ? 0
            : tokenTextContent.length
        )
      }

      if (container === tokenEl) {
        // Selection directly on the token span
        return Math.min(
          offsetInContainer,
          tokenTextContent.length === 1 && tokenTextContent === ZWS
            ? 0
            : tokenTextContent.length
        )
      }
      // Fallback for simple token if selection is weird
      return tokenTextContent.length === 1 && tokenTextContent === ZWS
        ? 0
        : tokenTextContent.length
    }

    const handleSelectionChange = () => {
      const sel = window.getSelection()
      const expectation = programmaticCursorExpectationRef.current

      if (
        !mainDivRef.current ||
        (document.activeElement &&
          !mainDivRef.current.contains(document.activeElement) &&
          document.activeElement !== mainDivRef.current)
      ) {
        console.log(
          '[selectionchange] Focus is OUTSIDE Inlay or Inlay unmounted. Clearing state.'
        )
        if (activeTokenRef.current) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        }
        if (savedCursorRef.current) {
          savedCursorRef.current = null
          setCaretState?.(null)
        }
        if (programmaticCursorExpectationRef.current) {
          programmaticCursorExpectationRef.current = null
        }
        if (
          typeof selectAllStateRef.current === 'object' &&
          selectAllStateRef.current.type === 'cross-token'
        ) {
          console.log(
            '[selectionchange] Focus outside, resetting selectAllStateRef to none.'
          )
          selectAllStateRef.current = 'none'
        }
        return
      }

      if (!sel || sel.rangeCount === 0) {
        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        }
        if (expectation) {
          console.log(
            '[selectionchange] Null/Empty selection, clearing expectation:',
            expectation
          )
          programmaticCursorExpectationRef.current = null
        }
        if (
          typeof selectAllStateRef.current === 'object' &&
          selectAllStateRef.current.type === 'cross-token'
        ) {
          console.log(
            '[selectionchange] Null/Empty selection, resetting selectAllStateRef to none.'
          )
          selectAllStateRef.current = 'none'
        }
        return
      }

      const range = sel.getRangeAt(0)
      const {
        startContainer,
        startOffset: domStartOffset,
        endContainer,
        endOffset: domEndOffset,
        collapsed
      } = range

      // If the selection is collapsed, any previous 'select all', 'select token', or 'cross-token' state is no longer valid.
      if (collapsed) {
        if (selectAllStateRef.current !== 'none') {
          console.log(
            `[selectionchange] Selection collapsed. Resetting selectAllStateRef from '${JSON.stringify(selectAllStateRef.current)}' to 'none'.`
          )
          selectAllStateRef.current = 'none'
        }
      }

      const startTokenEl =
        startContainer.nodeType === Node.TEXT_NODE
          ? (startContainer.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)
          : (startContainer as Element).closest?.('[data-token-id]')
            ? (startContainer as HTMLElement)
            : null

      const endTokenEl =
        endContainer.nodeType === Node.TEXT_NODE
          ? (endContainer.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)
          : (endContainer as Element).closest?.('[data-token-id]')
            ? (endContainer as HTMLElement)
            : null

      if (
        startTokenEl &&
        endTokenEl &&
        mainDivRef.current &&
        mainDivRef.current.contains(startTokenEl) &&
        mainDivRef.current.contains(endTokenEl) &&
        !collapsed // Selection must not be collapsed for cross-token
      ) {
        if (startTokenEl !== endTokenEl) {
          // Critical condition for cross-token
          const startTokenIdStr = startTokenEl.getAttribute('data-token-id')
          const endTokenIdStr = endTokenEl.getAttribute('data-token-id')

          if (startTokenIdStr && endTokenIdStr) {
            const startIdx = parseInt(startTokenIdStr)
            const endIdx = parseInt(endTokenIdStr)

            let finalStartTokenEl = startTokenEl
            let finalEndTokenEl = endTokenEl
            let finalStartIdx = startIdx
            let finalEndIdx = endIdx
            let finalStartContainerForOffset = startContainer
            let finalStartOffsetForOffset = domStartOffset
            let finalEndContainerForOffset = endContainer
            let finalEndOffsetForOffset = domEndOffset

            // Determine logical start and end based on document order
            const comparison =
              finalStartTokenEl.compareDocumentPosition(finalEndTokenEl)
            if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
              // startTokenEl is after endTokenEl (backward selection)
              finalStartTokenEl = endTokenEl
              finalEndTokenEl = startTokenEl
              finalStartIdx = endIdx
              finalEndIdx = startIdx
              finalStartContainerForOffset = endContainer
              finalStartOffsetForOffset = domEndOffset
              finalEndContainerForOffset = startContainer
              finalEndOffsetForOffset = domStartOffset
            } else if (!(comparison & Node.DOCUMENT_POSITION_FOLLOWING)) {
              // Not following and not preceding implies same node or error, but we check startTokenEl !== endTokenEl
              // This case should ideally not be hit if tokens are distinct.
              console.warn(
                '[selectionchange] Unexpected document position for distinct tokens.'
              )
              if (
                typeof selectAllStateRef.current === 'object' &&
                selectAllStateRef.current.type === 'cross-token'
              )
                selectAllStateRef.current = 'none'
              // Fall through to single token logic by not returning
            }

            const startOffsetInToken = getOffsetInToken(
              finalStartTokenEl,
              finalStartContainerForOffset,
              finalStartOffsetForOffset
            )
            const endOffsetInToken = getOffsetInToken(
              finalEndTokenEl,
              finalEndContainerForOffset,
              finalEndOffsetForOffset
            )

            selectAllStateRef.current = {
              type: 'cross-token',
              startTokenIndex: finalStartIdx,
              startOffset: startOffsetInToken,
              endTokenIndex: finalEndIdx,
              endOffset: endOffsetInToken
            }
            if (activeTokenRef.current) {
              activeTokenRef.current = null
              onTokenFocus?.(null)
            }

            // Token updated
            if (
              !programmaticCursorExpectationRef.current &&
              savedCursorRef.current
            ) {
              console.log(
                '[selectionchange] Cross-token detected, NO expectation, clearing savedCursor.'
              )
              savedCursorRef.current = null
              setCaretState?.(null) // Update caretState as well
            } else if (programmaticCursorExpectationRef.current) {
              console.log(
                '[selectionchange] Cross-token detected, but expectation exists. NOT clearing savedCursor.'
              )
            }

            console.log(
              '[selectionchange] Cross-token selection DETECTED/UPDATED in selectAllStateRef:',
              JSON.stringify(selectAllStateRef.current)
            )
            return // Handled cross-token selection
          }
        } else {
          // startTokenEl === endTokenEl, but selection is not collapsed
          // This is a selection within a single token. Clear any previous cross-token state.
          if (
            typeof selectAllStateRef.current === 'object' &&
            selectAllStateRef.current.type === 'cross-token'
          ) {
            console.log(
              '[selectionchange] Selection is within a single token, clearing cross-token state from selectAllStateRef.'
            )
            selectAllStateRef.current = 'none'
          }
        }
      } else {
        // Selection is not on any token, or is on a single token and collapsed,
        // or one of the tokens is not valid/within inlay.
        // Clear cross-token selection from selectAllStateRef if it was previously set.
        if (
          typeof selectAllStateRef.current === 'object' &&
          selectAllStateRef.current.type === 'cross-token'
        ) {
          console.log(
            '[selectionchange] Selection no longer valid for cross-token, clearing from selectAllStateRef.'
          )
          selectAllStateRef.current = 'none'
        }
      }

      // Original single token selection logic (proceed if not a cross-token selection)
      // This part should only run if selectAllStateRef.current is not a cross-token object
      if (
        typeof selectAllStateRef.current !== 'object' ||
        selectAllStateRef.current.type !== 'cross-token'
      ) {
        const currentActiveTokenEl =
          startContainer.nodeType === Node.TEXT_NODE
            ? (startContainer.parentElement?.closest(
                '[data-token-id]'
              ) as HTMLElement | null)
            : // If startContainer is an element, check if IT is the token, then try closest.
              startContainer instanceof HTMLElement &&
                startContainer.hasAttribute('data-token-id')
              ? startContainer
              : ((startContainer as Element).closest?.(
                  '[data-token-id]'
                ) as HTMLElement | null)

        if (
          currentActiveTokenEl &&
          mainDivRef.current &&
          !mainDivRef.current.contains(currentActiveTokenEl)
        ) {
          console.log(
            '[selectionchange] Focus moved outside tokenbox, resetting selectAllStateRef to none.'
          )
          selectAllStateRef.current = 'none'
          if (activeTokenRef.current !== null) {
            activeTokenRef.current = null
            onTokenFocus?.(null)
          }
          if (savedCursorRef.current) {
            console.log(
              '[selectionchange] Selection in root. Clearing savedCursor.'
            )
            savedCursorRef.current = null
            setCaretState?.(null)
          }
          if (programmaticCursorExpectationRef.current) {
            programmaticCursorExpectationRef.current = null
          }
          return
        }

        console.log(
          '[selectionchange] type:',
          currentActiveTokenEl?.dataset.tokenId,
          'container nodeType:',
          startContainer.nodeType,
          'expectation:',
          expectation
        )

        if (
          currentActiveTokenEl &&
          currentActiveTokenEl.hasAttribute('data-token-id')
        ) {
          const tokenIdStr = currentActiveTokenEl.getAttribute('data-token-id')!
          const newActiveIndex = parseInt(tokenIdStr)
          let finalOffset: number
          const tokenTextContent = currentActiveTokenEl.textContent || ''

          if (
            tokenTextContent === ZWS &&
            currentActiveTokenEl.getAttribute('data-token-editable') === 'true'
          ) {
            finalOffset = 0
          } else if (
            startContainer.nodeType === Node.TEXT_NODE &&
            currentActiveTokenEl.contains(startContainer)
          ) {
            finalOffset = domStartOffset
          } else if (startContainer === currentActiveTokenEl) {
            finalOffset = tokenTextContent.length
          } else {
            finalOffset = tokenTextContent.length
          }

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
            if (expectation.offset === finalOffset) {
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
                // Update caretState when cursor position changes within a token
                setCaretState?.({
                  index: newActiveIndex,
                  offset: finalOffset
                })
              }
              programmaticCursorExpectationRef.current = null
            } else {
              console.warn(
                '[selectionchange] Expectation MISMATCH for token',
                newActiveIndex,
                '. Expected offset:',
                expectation.offset,
                'Actual DOM offset:',
                finalOffset,
                'Not updating savedCursor. Letting useLayoutEffect reconcile.'
              )
              return
            }
          } else {
            if (expectation) {
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
              return
            }

            const currentSaved = savedCursorRef.current
            if (!currentSaved || currentSaved.index !== newActiveIndex) {
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
              // Update caretState when cursor position changes within a token
              setCaretState?.({
                index: newActiveIndex,
                offset: finalOffset
              })
            } else {
              console.log(
                '[selectionchange] No/Diff Expectation: Selection on same token index',
                newActiveIndex,
                '. savedCursor.offset:',
                currentSaved.offset,
                'DOM reports offset:',
                finalOffset,
                '. NOT updating savedCursor.offset.'
              )
              // Add this check - if the offset changed within the same token
              if (currentSaved.offset !== finalOffset) {
                console.log(
                  '[selectionchange] Offset changed within same token. Updating savedCursor.'
                )
                savedCursorRef.current = {
                  index: newActiveIndex,
                  offset: finalOffset
                }
                setCaretState?.({
                  index: newActiveIndex,
                  offset: finalOffset
                })
              }
              if (
                savedCursorRef.current === null &&
                typeof newActiveIndex === 'number'
              ) {
                console.warn(
                  '[selectionchange] savedCursor was null but selection is on same token index. This is unexpected. Setting savedCursor offset to DOM offset as a fallback.'
                )
                savedCursorRef.current = {
                  index: newActiveIndex,
                  offset: finalOffset
                }
                // Update caretState when cursor position changes within a token
                setCaretState?.({
                  index: newActiveIndex,
                  offset: finalOffset
                })
              }
            }
          }

          const oldActiveToken = activeTokenRef.current
          if (oldActiveToken !== currentActiveTokenEl) {
            activeTokenRef.current = currentActiveTokenEl
            onTokenFocus?.(newActiveIndex)
            if (
              typeof selectAllStateRef.current === 'object' &&
              selectAllStateRef.current.type === 'cross-token'
            ) {
              console.log(
                '[selectionchange] Active token changed, resetting selectAllStateRef from cross-token to none.'
              )
              selectAllStateRef.current = 'none'
            }
          }
        } else {
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
            if (
              typeof selectAllStateRef.current === 'object' &&
              selectAllStateRef.current.type === 'cross-token'
            ) {
              console.log(
                '[selectionchange] Selection no longer on a token, resetting selectAllStateRef from cross-token to none.'
              )
              selectAllStateRef.current = 'none'
            }
          }
          if (
            mainDivRef.current &&
            document.activeElement &&
            mainDivRef.current.contains(document.activeElement)
          ) {
            if (savedCursorRef.current !== null) {
              console.log(
                '[selectionchange] Selection in root. Clearing savedCursor.'
              )
              savedCursorRef.current = null
              setCaretState?.(null)
            }
          }
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [
    onTokenFocus,
    mainDivRef,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    setCaretState
  ]) // Added other refs to dependency array
}
