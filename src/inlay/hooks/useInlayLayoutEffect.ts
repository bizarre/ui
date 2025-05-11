import * as React from 'react'

export interface UseInlayLayoutEffectProps<T> {
  tokens: Readonly<T[]>
  restoreCursor: (
    cursorToRestore?: { index: number; offset: number } | null
  ) => void
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
  domKeyRef: React.RefObject<number> // Assuming it's a RefObject based on usage
  prevDomKeyValueRef: React.MutableRefObject<number> // Assuming MutableRefObject
  forceImmediateRestoreRef: React.MutableRefObject<boolean> // Added prop type
}

export function useInlayLayoutEffect<T>(props: UseInlayLayoutEffectProps<T>) {
  const {
    tokens,
    restoreCursor,
    mainDivRef,
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    domKeyRef,
    prevDomKeyValueRef,
    forceImmediateRestoreRef // Destructure here
  } = props

  React.useLayoutEffect(() => {
    const currentDomKey = domKeyRef.current // domKeyRef is a RefObject, so .current might be null if not initialized
    // Ensure currentDomKey has a valid number before proceeding if it can be null initially,
    // though in _Inlay it's React.useRef(0) so it should be number.
    // For safety, one might add: if (currentDomKey === null) return;

    const domWasReKeyed = prevDomKeyValueRef.current !== currentDomKey

    console.log(
      `[useLayoutEffect #${currentDomKey}] START. domWasReKeyed: ${domWasReKeyed}`,
      'savedCursorRef:',
      savedCursorRef.current,
      'activeTokenRef:',
      activeTokenRef.current?.dataset.tokenId,
      'forceImmediateRestoreRef:',
      forceImmediateRestoreRef.current, // Log the ref value
      'document.activeElement BEFORE any logic:',
      document.activeElement === mainDivRef.current
        ? 'main_div'
        : document.activeElement?.getAttribute('data-token-id') ||
            document.activeElement?.tagName ||
            document.activeElement
    )

    if (savedCursorRef.current) {
      const definitelySavedCursor: { index: number; offset: number } =
        savedCursorRef.current
      const targetTokenId = definitelySavedCursor.index

      const executeFocusLogic = (foundTokenElement: HTMLElement | null) => {
        requestAnimationFrame(() => {
          const focusTarget = mainDivRef.current

          if (foundTokenElement) {
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
              console.log(
                `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: main div (focusTarget) disconnected. Bailing.`
              )
              return
            }
            if (!foundTokenElement.isConnected) {
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
            const cursorToEffect = savedCursorRef.current

            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: About to restoreCursor. Target: ${cursorToEffect.index}, Offset: ${cursorToEffect.offset}, Current activeElement: ${document.activeElement?.tagName}`
            )
            restoreCursor(cursorToEffect)
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF_INNER] Core restore logic: After restoreCursor. Current activeElement: ${document.activeElement === mainDivRef.current ? 'main_div' : document.activeElement?.getAttribute('data-token-id') || document.activeElement?.tagName}`
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

      const saved = savedCursorRef.current // Re-check savedCursorRef before deciding path
      const activeIdx = activeTokenRef.current
        ? parseInt(activeTokenRef.current.dataset.tokenId!)
        : null

      // Ensure mainDivRef.current is not null before accessing properties or methods
      const needsDoubleRAF =
        saved &&
        mainDivRef.current &&
        document.activeElement === mainDivRef.current &&
        (activeIdx === null || activeIdx !== saved.index)

      if (forceImmediateRestoreRef.current) {
        console.log(
          `[useLayoutEffect #${currentDomKey}] Prioritizing forceImmediateRestoreRef. Scheduling single rAF.`
        )
        forceImmediateRestoreRef.current = false // Reset the flag
        requestAnimationFrame(() => {
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF_IMMEDIATE] Running. Querying for token: ${targetTokenId}. activeElement BEFORE: ${document.activeElement?.tagName}`
          )
          const tokenElementInRAF = mainDivRef.current?.querySelector(
            `[data-token-id="${targetTokenId}"]`
          ) as HTMLElement | null
          executeFocusLogic(tokenElementInRAF)
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF_IMMEDIATE] END. activeElement AFTER executeFocusLogic: ${document.activeElement?.tagName}`
          )
        })
      } else if (needsDoubleRAF) {
        console.log(
          `[useLayoutEffect #${currentDomKey}] Needs double rAF (new token focus?). Scheduling query and focus/restore in double rAF.`
        )
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF2] Running for needsDoubleRAF. Querying for token: ${targetTokenId}. activeElement BEFORE: ${document.activeElement?.tagName}`
            )
            const tokenElementInRAF = mainDivRef.current?.querySelector(
              `[data-token-id="${targetTokenId}"]`
            ) as HTMLElement | null
            executeFocusLogic(tokenElementInRAF)
            console.log(
              `[useLayoutEffect #${currentDomKey} rAF2] END. activeElement AFTER executeFocusLogic: ${document.activeElement?.tagName}`
            )
          })
        })
      } else {
        console.log(
          `[useLayoutEffect #${currentDomKey}] Needs single rAF (domWasReKeyed: ${domWasReKeyed}, or other conditions not met for double). Scheduling query and focus/restore in single rAF.`
        )
        requestAnimationFrame(() => {
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF1] Running. Querying for token: ${targetTokenId}. activeElement BEFORE: ${document.activeElement?.tagName}`
          )
          // Ensure mainDivRef.current is available before querying
          const targetTokenElement = mainDivRef.current?.querySelector(
            `[data-token-id="${targetTokenId}"]`
          ) as HTMLElement | null
          executeFocusLogic(targetTokenElement)
          console.log(
            `[useLayoutEffect #${currentDomKey} rAF1] END. activeElement AFTER executeFocusLogic: ${document.activeElement?.tagName}`
          )
        })
      }
    } else {
      console.log(
        `[useLayoutEffect #${currentDomKey}] No savedCursorRef.current. activeElement: ${document.activeElement?.tagName}`
      )
      if (
        tokens.length === 0 &&
        mainDivRef.current &&
        document.activeElement !== mainDivRef.current &&
        !mainDivRef.current.contains(document.activeElement)
      ) {
        console.log(
          `[useLayoutEffect #${currentDomKey}] No tokens, focusing main div. activeElement BEFORE: ${document.activeElement?.tagName}`
        )
        mainDivRef.current.focus() // Check if mainDivRef.current is not null
        console.log(
          `[useLayoutEffect #${currentDomKey}] No tokens, focused main div. activeElement AFTER: ${document.activeElement?.tagName}`
        )
        if (activeTokenRef.current !== null) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
        }
      } else if (
        tokens.length > 0 &&
        mainDivRef.current &&
        document.activeElement === mainDivRef.current &&
        !activeTokenRef.current
      ) {
        console.log(
          '[useLayoutEffect] Tokens exist, main div active, no activeTokenRef. Focusing first token.'
        )
        const firstTokenEl = mainDivRef.current.querySelector(
          '[data-token-id="0"]'
        ) as HTMLElement | null
        if (firstTokenEl) {
          activeTokenRef.current = firstTokenEl
          onTokenFocus?.(0)
          savedCursorRef.current = { index: 0, offset: 0 }
        }
      }
    }
    // Ensure currentDomKey is number before assigning to prevDomKeyValueRef.current
    if (typeof currentDomKey === 'number') {
      prevDomKeyValueRef.current = currentDomKey
    }

    // Dependency array matching the original useLayoutEffect
  }, [
    tokens,
    restoreCursor,
    mainDivRef,
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    domKeyRef,
    prevDomKeyValueRef,
    forceImmediateRestoreRef
  ])
}
