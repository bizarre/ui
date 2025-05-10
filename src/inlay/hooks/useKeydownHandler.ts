import * as React from 'react'
import { ZWS } from '../inlay.constants'
import type {
  // TokenHandle, // Unused
  // OnInputGlobalActions, // Unused
  // OnInputContext, // Unused directly, but InlayProps uses it via onCharInput prop type
  InlayProps,
  OnInputGlobalActions,
  TokenHandle
} from '../inlay.types'

// Re-import OnInputContext specifically if needed for the onCharInput prop type directly
import type { OnInputContext } from '../inlay.types'

export type UseKeydownHandlerProps<T> = {
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
  mainDivRef: React.RefObject<HTMLDivElement | null> // ref from _Inlay
  selectAllStateRef: React.MutableRefObject<'none' | 'token' | 'all'>

  // Callbacks from _Inlay or its props
  parseToken: (value: string) => T | null
  removeToken: (index: number) => void // This is the removeToken from _Inlay's scope
  saveCursor: () => void // This is the saveCursor from _Inlay's scope
  onTokenFocus?: (index: number | null) => void

  // Props from InlayProps<T>
  onCharInput?: (context: OnInputContext<T>) => void
  commitOnChars?: string[]
  defaultNewTokenValue?: T
  addNewTokenOnCommit: boolean // Needs to be passed (has default in _Inlay)
  insertSpacerOnCommit: boolean // Needs to be passed (has default in _Inlay)
  displayCommitCharSpacer?: InlayProps<T>['displayCommitCharSpacer']
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
    onTokenFocus,
    onCharInput,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    displayCommitCharSpacer
  } = props

  // handleRemoveTokenOnKeyDown logic will be moved here (as an inner function or integrated)
  const handleRemoveTokenOnKeyDownInternal = React.useCallback(
    (
      e: React.KeyboardEvent<HTMLDivElement>,
      selectAllState: 'none' | 'token' | 'all'
    ) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return

      const currentSelection = window.getSelection()
      if (!currentSelection || currentSelection.rangeCount === 0) return

      const rangeForLog = currentSelection.getRangeAt(0)
      const localActiveTokenForLog = activeTokenRef.current
      const activeIndexForLog = localActiveTokenForLog?.getAttribute(
        'data-token-id'
      )
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
          const activeTokenIdStr =
            localActiveToken.getAttribute('data-token-id')
          if (!activeTokenIdStr) return
          const activeIndex = parseInt(activeTokenIdStr)

          console.log(
            '[handleRemoveTokenOnKeyDown] selectAllState=token: Clearing content of token',
            activeIndex
          )

          const newTokenValue = parseToken('')
          if (newTokenValue !== null) {
            setTokens((prevTokens) => {
              const updatedTokens = [...prevTokens]
              updatedTokens[activeIndex] = newTokenValue
              return updatedTokens
            })
            savedCursorRef.current = { index: activeIndex, offset: 0 }
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
        const activeTokenIdStr = localActiveToken.getAttribute('data-token-id')
        if (!activeTokenIdStr) return
        const activeIndex = parseInt(activeTokenIdStr)
        const currentText =
          localActiveToken.textContent === ZWS
            ? ''
            : localActiveToken.textContent || ''
        const textNode = localActiveToken.firstChild

        if (
          textNode &&
          textNode.nodeType === Node.TEXT_NODE &&
          (startContainer === textNode || startContainer === localActiveToken) // Selection on text or token itself
        ) {
          let newText = currentText
          let newCursorOffset = startOffset

          if (isCollapsed) {
            if (e.key === 'Backspace') {
              if (startOffset === 0) {
                if (activeIndex > 0) {
                  e.preventDefault()
                  const prevTokenIndex = activeIndex - 1
                  const prevTokenValue = tokens[prevTokenIndex]
                  const currentTokenValue = tokens[activeIndex]
                  const prevTokenTextForMerge = String(
                    prevTokenValue === (ZWS as any)
                      ? ''
                      : (prevTokenValue ?? '')
                  )
                  const currentTokenTextForMerge = String(
                    currentTokenValue === (ZWS as any)
                      ? ''
                      : (currentTokenValue ?? '')
                  )
                  const mergedText =
                    prevTokenTextForMerge + currentTokenTextForMerge
                  const newParsedMergedToken = parseToken(mergedText)

                  if (newParsedMergedToken !== null) {
                    const newTokensState = [...tokens]
                    newTokensState[prevTokenIndex] = newParsedMergedToken
                    newTokensState.splice(activeIndex, 1)
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
                    return
                  } else {
                    console.warn(
                      '[handleRemoveTokenOnKeyDown] Merge attempt failed: parseToken returned null. No action.'
                    )
                    return
                  }
                }
              } else {
                e.preventDefault()
                newText =
                  currentText.slice(0, startOffset - 1) +
                  currentText.slice(startOffset)
                newCursorOffset = startOffset - 1
              }
            } else if (e.key === 'Delete') {
              if (startOffset === currentText.length) {
                if (activeIndex < tokens.length - 1) {
                  e.preventDefault()
                  const nextTokenIndex = activeIndex + 1
                  const currentTokenValue = tokens[activeIndex]
                  const nextTokenValue = tokens[nextTokenIndex]
                  const currentTokenTextForMerge = String(
                    currentTokenValue === (ZWS as any)
                      ? ''
                      : (currentTokenValue ?? '')
                  )
                  const nextTokenTextForMerge = String(
                    nextTokenValue === (ZWS as any)
                      ? ''
                      : (nextTokenValue ?? '')
                  )
                  const mergedText =
                    currentTokenTextForMerge + nextTokenTextForMerge
                  const newParsedMergedToken = parseToken(mergedText)

                  if (newParsedMergedToken !== null) {
                    const newTokensState = [...tokens]
                    newTokensState[activeIndex] = newParsedMergedToken
                    newTokensState.splice(nextTokenIndex, 1)
                    const newSpacerCharsState = [...spacerChars]
                    newSpacerCharsState.splice(activeIndex, 1)
                    setTokens(newTokensState)
                    setSpacerChars(newSpacerCharsState)
                    savedCursorRef.current = {
                      index: activeIndex,
                      offset: currentTokenTextForMerge.length
                    }
                    programmaticCursorExpectationRef.current =
                      savedCursorRef.current
                    return
                  } else {
                    console.warn(
                      '[handleRemoveTokenOnKeyDown] Merge (Delete) failed: parseToken returned null. No action.'
                    )
                    return
                  }
                }
              } else {
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
            // Check if any path above called preventDefault
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
              removeToken(activeIndex)
            }
            return
          }
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
      saveCursor
    ]
  )

  const onKeydownHandler = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let preventDefaultCalledByOnCharInput = false
      const setPreventDefaultFlag = () => {
        preventDefaultCalledByOnCharInput = true
      }

      if (onCharInput && (e.key.length === 1 || e.key === 'Enter')) {
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
          const currentTextInDOM =
            (currentActiveTokenElement.textContent === ZWS
              ? ''
              : currentActiveTokenElement.textContent) || ''
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
                programmaticCursorExpectationRef.current =
                  savedCursorRef.current
                setPreventDefaultFlag()
              }
            },
            split: (options) => {
              if (
                !isEditable ||
                cursorOffsetInToken === 0 ||
                cursorOffsetInToken === currentTextInDOM.length
              )
                return
              const textForFirstPart = currentTextInDOM.substring(
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
                setPreventDefaultFlag()
              }
            },
            commit: (options) => {
              if (!isEditable) return
              const committedValue = parseToken(currentTextInDOM)
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
                /* Allow removing single non-editable */
              } else if (!isEditable) return
              removeToken(activeIndex)
              setPreventDefaultFlag()
            }
          }
        }

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
            setPreventDefaultFlag()
          },
          removeAt: (indexToRemove) => {
            removeToken(indexToRemove)
            setPreventDefaultFlag()
          },
          replaceAll: (newTokens, newCursor, newSpacers) => {
            setTokens(newTokens)
            if (newSpacers) setSpacerChars(newSpacers)
            else setSpacerChars(Array(newTokens.length).fill(null))
            savedCursorRef.current = newCursor
            programmaticCursorExpectationRef.current = newCursor
            setPreventDefaultFlag()
          }
        }

        const contextForOnCharInput: OnInputContext<T> = {
          key: e.key,
          tokens: [...tokens],
          token: tokenHandleForContext,
          actions: globalActionsForContext
        }
        onCharInput(contextForOnCharInput)
        if (preventDefaultCalledByOnCharInput) {
          e.preventDefault()
          if (selectAllStateRef.current !== 'none')
            selectAllStateRef.current = 'none'
          return
        }
      }

      if (commitOnChars && commitOnChars.includes(e.key)) {
        if (
          activeTokenRef.current?.getAttribute('data-token-editable') === 'true'
        ) {
          e.preventDefault()
          const activeTokenElement = activeTokenRef.current
          const activeIndex = parseInt(
            activeTokenElement.getAttribute('data-token-id')!
          )
          const currentTokenText =
            (activeTokenElement.textContent === ZWS
              ? ''
              : activeTokenElement.textContent) || ''
          let charOffsetInToken = -1
          // ... (logic for charOffsetInToken as in original) ...
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
                savedCursorRef.current = { index: activeIndex + 1, offset: 0 }
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
        // if (e.defaultPrevented) return; // This was in original, might be needed depending on flow
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
      onTokenFocus,
      onCharInput,
      commitOnChars,
      defaultNewTokenValue,
      addNewTokenOnCommit,
      insertSpacerOnCommit,
      displayCommitCharSpacer,
      handleRemoveTokenOnKeyDownInternal // Include the memoized helper
    ]
  )

  return onKeydownHandler
}
