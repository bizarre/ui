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
  selectAllStateRef: React.MutableRefObject<'none' | 'token' | 'all'>
}

export function useSelectionChangeHandler(
  props: UseSelectionChangeHandlerProps
) {
  const {
    mainDivRef,
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef
  } = props

  React.useEffect(() => {
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

      if (
        tokenEl &&
        mainDivRef.current &&
        !mainDivRef.current.contains(tokenEl)
      ) {
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
            }
          }
        }

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
    selectAllStateRef
  ]) // Added other refs to dependency array
}
