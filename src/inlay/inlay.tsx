import * as React from 'react'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { Slot } from '@radix-ui/react-slot'
import { ScopedProps } from '../types'
import { COMPONENT_NAME, ZWS } from './inlay.constants'
import type {
  InlayContextValue,
  InlayProps,
  InlayTokenProps,
  CaretPosition,
  InlayHistoryEntry,
  InlayOperationType
} from './inlay.types'
import { useBeforeInputHandler } from './hooks/useBeforeInputHandler'
import { useKeydownHandler } from './hooks/useKeydownHandler'
import { processRootText } from './utils/process-root-text'
import { useInlayLayoutEffect } from './hooks/useInlayLayoutEffect'
import {
  useSelectionChangeHandler,
  type SelectAllState
} from './hooks/useSelectionChangeHandler'
import { useMemoizedCallback } from './hooks/useMemoizedCallback'
import { useCopyHandler } from './hooks/useCopyHandler'
import { usePasteHandler } from './hooks/usePasteHandler'
import { useInlayHistory } from './hooks/useInlayHistory'

const DEBUG_HISTORY = true

const [createInlayContext] = createContextScope(COMPONENT_NAME)

const [InlayProvider, useInlayContext] =
  createInlayContext<InlayContextValue<unknown>>(COMPONENT_NAME)

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
    caret: caretProp,
    defaultCaret,
    onCaretChange,
    parse: parseToken,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit = true,
    insertSpacerOnCommit = true,
    displayCommitCharSpacer = true,
    onInput: onCharInput,
    style,
    className,
    multiline = false,
    ...props
  }: ScopedProps<
    InlayProps<T> & {
      className?: string
    }
  >,
  forwardedRef: React.Ref<HTMLElement>
) => {
  const memoizedOnTokenFocus = useMemoizedCallback(onTokenFocus)
  const memoizedOnTokensChange = useMemoizedCallback(onTokensChange)
  const memoizedParseToken = useMemoizedCallback(parseToken)
  const memoizedOnTokenChange = useMemoizedCallback(onTokenChange)
  const memoizedOnCharInput = useMemoizedCallback(onCharInput)
  const memoizedDisplayCommitCharSpacer =
    typeof displayCommitCharSpacer === 'function'
      ? useMemoizedCallback(
          displayCommitCharSpacer as (
            commitChar: string,
            afterTokenIndex: number
          ) => React.ReactNode
        )
      : displayCommitCharSpacer

  const ref = React.useRef<HTMLDivElement>(null)
  const activeTokenRef = React.useRef<HTMLElement | null>(null)
  const domKeyRef = React.useRef(0)
  const prevDomKeyValueRef = React.useRef(domKeyRef.current)
  const selectAllStateRef = React.useRef<SelectAllState>('none')
  const programmaticCursorExpectationRef = React.useRef<CaretPosition | null>(
    null
  )
  const forceImmediateRestoreRef = React.useRef(false)
  const [spacerChars, setSpacerChars] = React.useState<(string | null)[]>([])

  const editableTextValuesRef = React.useRef<{
    [index: number]: string | undefined
  }>({})

  const inlayHistory = useInlayHistory<T>()
  const isRestoringHistoryRef = React.useRef(false)
  const lastOperationTypeRef = React.useRef<InlayOperationType>('unknown')

  const _registerEditableTextValue = React.useCallback(
    (index: number, text: string | null) => {
      if (text === null) {
        delete editableTextValuesRef.current[index]
      } else {
        editableTextValuesRef.current[index] = text
      }
    },
    []
  )

  const _getEditableTextValue = React.useCallback(
    (index: number): string | undefined => {
      return editableTextValuesRef.current[index]
    },
    []
  )

  const [tokens, setTokens] = useControllableState({
    prop: tokensProp,
    defaultProp: defaultTokens ?? [],
    onChange: memoizedOnTokensChange
  })

  const [caretState, setCaretState] =
    useControllableState<CaretPosition | null>({
      prop: caretProp as CaretPosition | undefined,
      defaultProp: (defaultCaret ?? null) as CaretPosition | null,
      onChange: onCaretChange
    })

  const isSameCaret = React.useCallback(
    (a: CaretPosition | null, b: CaretPosition | null) => {
      if (a === b) return true
      if (a === null || b === null) return false
      return a.index === b.index && a.offset === b.offset
    },
    []
  )

  const renderSpacer = React.useCallback(
    (spacerChar: string, afterTokenIndex: number): React.ReactNode => {
      if (multiline && spacerChar === '\n') {
        return '\n'
      }
      if (typeof memoizedDisplayCommitCharSpacer === 'function') {
        return memoizedDisplayCommitCharSpacer(spacerChar, afterTokenIndex)
      }
      if (memoizedDisplayCommitCharSpacer === true) {
        return (
          <span
            contentEditable="false"
            suppressContentEditableWarning
            style={{ whiteSpace: 'pre', display: 'inline' }}
            data-spacer-char={spacerChar}
            data-spacer-after-token={afterTokenIndex}
          >
            {spacerChar}
          </span>
        )
      }
      return null
    },
    [memoizedDisplayCommitCharSpacer, multiline]
  )

  React.useEffect(() => {
    if (isRestoringHistoryRef.current) {
      if (DEBUG_HISTORY)
        console.log(
          '[_Inlay SpacerEffect] Skipping spacer adjustment due to history restoration.'
        )
      return
    }
    const expectedSpacerCount = Math.max(0, tokens.length - 1)

    const isTrailingNullState =
      spacerChars.length === expectedSpacerCount + 1 &&
      spacerChars[spacerChars.length - 1] === null

    if (spacerChars.length !== expectedSpacerCount) {
      if (isTrailingNullState) {
        if (DEBUG_HISTORY)
          console.log(
            '[_Inlay SpacerEffect] spacerChars length is expected+1 with trailing null. No adjustment needed. Current:',
            spacerChars
          )
      } else {
        if (DEBUG_HISTORY)
          console.log(
            '[_Inlay SpacerEffect] Adjusting spacers due to unexpected length. Current:',
            spacerChars,
            'Expected count:',
            expectedSpacerCount,
            'Based on tokens length:',
            tokens.length
          )
        const newSpacers = Array(expectedSpacerCount).fill(null)
        for (
          let i = 0;
          i < Math.min(spacerChars.length, expectedSpacerCount);
          i++
        ) {
          newSpacers[i] = spacerChars[i]
        }
        setSpacerChars(newSpacers)
      }
    }
  }, [tokens.length, spacerChars, setSpacerChars, isRestoringHistoryRef])

  const savedCursorRef = React.useRef<CaretPosition | null>(null)
  const uniqueId = React.useId()

  React.useEffect(() => {
    const initialSpacers = Array(Math.max(0, tokens.length - 1)).fill(null)
    inlayHistory.initializePresent({
      tokens: tokens,
      spacerChars: initialSpacers,
      caretState: caretState,
      selectAllState: selectAllStateRef.current
    })
  }, [])

  React.useEffect(() => {
    if (DEBUG_HISTORY) {
      console.log(
        '[_Inlay History Record] Effect triggered. isRestoring:',
        isRestoringHistoryRef.current,
        'lastOpRef:',
        lastOperationTypeRef.current
      )
    }
    if (isRestoringHistoryRef.current) {
      if (DEBUG_HISTORY) {
        console.log(
          '[_Inlay History Record] Skipping: isRestoringHistoryRef is true.'
        )
      }
      return
    }

    const effectiveCaretForSnapshot =
      savedCursorRef.current !== null ? savedCursorRef.current : caretState

    if (DEBUG_HISTORY && effectiveCaretForSnapshot !== caretState) {
      console.log(
        '[_Inlay History Record] Using savedCursorRef for snapshot. savedCursorRef:',
        savedCursorRef.current,
        'Original caretState from state:',
        caretState
      )
    }

    let operationForSnapshot = lastOperationTypeRef.current
    const previousHistoryEntryData = inlayHistory.getPresentEntryData()

    if (operationForSnapshot === 'unknown' && previousHistoryEntryData) {
      const currentComponentStateData = {
        tokens: tokens,
        spacerChars: spacerChars,
        caretState: effectiveCaretForSnapshot,
        selectAllState: selectAllStateRef.current
      }
      const previousHistoryDataForComparison = {
        tokens: previousHistoryEntryData.tokens,
        spacerChars: previousHistoryEntryData.spacerChars,
        caretState: previousHistoryEntryData.caretState,
        selectAllState: previousHistoryEntryData.selectAllState
      }

      if (
        JSON.stringify(currentComponentStateData) !==
        JSON.stringify(previousHistoryDataForComparison)
      ) {
        if (DEBUG_HISTORY) {
          console.log(
            "[_Inlay History Record] lastOpRef was unknown, but current data differs from history. Assuming 'typing'."
          )
        }
        operationForSnapshot = 'typing'
      } else {
        if (DEBUG_HISTORY) {
          console.log(
            '[_Inlay History Record] lastOpRef was unknown, and current data matches history. Keeping op as unknown for snapshot.'
          )
        }
      }
    }

    const snapshotDataForSetPresent: Omit<InlayHistoryEntry<T>, 'timestamp'> = {
      tokens: tokens,
      spacerChars: spacerChars,
      caretState: effectiveCaretForSnapshot,
      selectAllState: selectAllStateRef.current,
      operationType: operationForSnapshot
    }

    if (DEBUG_HISTORY) {
      console.log(
        '[_Inlay History Record] Attempting to record snapshot with opType:',
        operationForSnapshot,
        JSON.parse(JSON.stringify(snapshotDataForSetPresent))
      )
    }
    const historyWasUpdated = inlayHistory.setPresent(snapshotDataForSetPresent)

    if (historyWasUpdated) {
      if (DEBUG_HISTORY) {
        console.log(
          '[_Inlay History Record] History was updated by setPresent. Resetting lastOperationTypeRef to unknown.'
        )
      }
      lastOperationTypeRef.current = 'unknown'
    } else {
      if (DEBUG_HISTORY) {
        console.log(
          '[_Inlay History Record] History was NOT updated by setPresent. lastOperationTypeRef remains:',
          lastOperationTypeRef.current
        )
      }
    }
  }, [tokens, spacerChars, caretState, savedCursorRef, inlayHistory])

  useSelectionChangeHandler({
    mainDivRef: ref,
    activeTokenRef,
    onTokenFocus: memoizedOnTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    setCaretState
  })

  const saveCursor = React.useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      savedCursorRef.current = null
      if (!isSameCaret(null, caretState)) {
        setCaretState(null)
      }
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

    if (tokenEl) {
      const tokenIdStr = tokenEl.getAttribute('data-token-id')
      if (tokenIdStr) {
        const tokenIndex = parseInt(tokenIdStr)
        let finalOffset = offset

        const editableRegion = tokenEl.querySelector(
          '[data-inlay-editable-region="true"]'
        ) as HTMLElement | null

        if (editableRegion) {
          const editableRegionText = editableRegion.textContent || ''
          if (
            container === editableRegion ||
            editableRegion.contains(container)
          ) {
            finalOffset = Math.min(
              offset,
              (editableRegion.firstChild?.textContent || '').length
            )
            if (
              editableRegion.firstChild?.textContent === ZWS &&
              finalOffset === 1
            )
              finalOffset = 0
          } else if (container === tokenEl) {
            finalOffset =
              editableRegionText === ZWS ? 0 : editableRegionText.length
          } else {
            finalOffset =
              editableRegionText === ZWS ? 0 : editableRegionText.length
          }
        } else {
          if (container === tokenEl) {
            finalOffset = (tokenEl.textContent || '').length
          } else if (tokenEl.contains(container)) {
            finalOffset = Math.min(offset, (container.textContent || '').length)
          } else {
            finalOffset = (tokenEl.textContent || '').length
          }
        }

        const newCaret: CaretPosition = {
          index: tokenIndex,
          offset: finalOffset
        }
        savedCursorRef.current = newCaret
        if (!isSameCaret(newCaret, caretState)) {
          setCaretState(newCaret)
        }
        return
      }
    }
    if (savedCursorRef.current !== null) {
      savedCursorRef.current = null
      if (!isSameCaret(null, caretState)) {
        setCaretState(null)
      }
    }
  }, [caretState, isSameCaret, setCaretState])

  const restoreCursor = React.useCallback(
    (cursorToRestore?: CaretPosition | null) => {
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

      let targetNodeForCursor: Node | null = null
      let effectiveOffset = saved.offset

      const editableRegion = element.querySelector(
        '[data-inlay-editable-region="true"]'
      ) as HTMLElement | null

      if (editableRegion) {
        const regionTextContent = editableRegion.textContent || ''
        if (
          editableRegion.firstChild &&
          editableRegion.firstChild.nodeType === Node.TEXT_NODE
        ) {
          targetNodeForCursor = editableRegion.firstChild
          effectiveOffset = Math.min(saved.offset, regionTextContent.length)
        } else if (regionTextContent === '' && saved.offset === 0) {
          targetNodeForCursor = editableRegion
          effectiveOffset = 0
        } else {
          targetNodeForCursor = editableRegion
          effectiveOffset = 0
        }
      } else if (
        element.firstChild &&
        element.firstChild.nodeType === Node.TEXT_NODE
      ) {
        targetNodeForCursor = element.firstChild
        effectiveOffset = Math.min(
          saved.offset,
          (element.firstChild.textContent || '').length
        )
      } else if (textContent === '' && saved.offset === 0) {
        targetNodeForCursor = element
        effectiveOffset = 0
      } else {
        targetNodeForCursor = element
        effectiveOffset = 0
      }

      if (targetNodeForCursor) {
        try {
          if (targetNodeForCursor.nodeType === Node.TEXT_NODE) {
            range.setStart(targetNodeForCursor, effectiveOffset)
            range.collapse(true)
          } else if (targetNodeForCursor.nodeType === Node.ELEMENT_NODE) {
            range.selectNodeContents(targetNodeForCursor)
            range.collapse(true)
          } else {
            return
          }
          sel.removeAllRanges()
          sel.addRange(range)
        } catch (err) {
          console.error('[restoreCursor] Error setting range:', err, {
            targetNode: targetNodeForCursor,
            effectiveOffset,
            savedCursor: saved
          })
        }
      } else {
        return
      }

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

  const onDivInput = React.useCallback(() => {
    lastOperationTypeRef.current = 'unknown'
    saveCursor()

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

    requestAnimationFrame(() => {
      let elementToProcess = initiallySelectedTokenElementForRAF

      if (
        activeTokenRef.current &&
        ref.current &&
        ref.current.contains(activeTokenRef.current) &&
        document.activeElement === ref.current
      ) {
        if (elementToProcess !== activeTokenRef.current) {
          elementToProcess = activeTokenRef.current
        }
      }

      let newTokensToSet: T[] | null = null

      if (elementToProcess && elementToProcess.hasAttribute('data-token-id')) {
        const activeTokenId = elementToProcess.getAttribute('data-token-id')!
        const activeIndex = parseInt(activeTokenId)
        const rawDomTextContent = elementToProcess.textContent || ''
        const textToParse = rawDomTextContent === ZWS ? '' : rawDomTextContent
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
        newTokensToSet = processRootText(
          textToParseForRoot,
          tokens,
          parseToken,
          savedCursorRef
        )
      }

      if (newTokensToSet !== null) {
        setTokens(newTokensToSet)
      }
    })
  }, [tokens, parseToken, setTokens, saveCursor, ref])

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

  const removeTokenScoped = React.useCallback(
    (index: number) => {
      const currentActiveTokenId =
        activeTokenRef.current?.getAttribute('data-token-id')
      let nextCursorIndex: number | null = null

      if (
        currentActiveTokenId === index.toString() ||
        (tokens.length === 1 && index === 0)
      ) {
        activeTokenRef.current = null
        onTokenFocus?.(null)

        if (tokens.length > 1) {
          if (index > 0) {
            nextCursorIndex = index - 1
          } else {
            nextCursorIndex = 0
          }
        } else {
          nextCursorIndex = null
        }
      }

      setTokens((prev) => {
        if (index < 0 || index >= prev.length) return prev
        const newTokens = prev.filter((_, i) => i !== index)

        const newSpacerCharsList = spacerChars.filter((_, i) => {
          if (index < spacerChars.length) {
            return i !== index
          } else if (
            index > 0 &&
            index === prev.length - 1 &&
            i === index - 1
          ) {
            return false
          }
          return true
        })
        setSpacerChars(newSpacerCharsList)

        const getTokenStringForOffset = (
          tok: T,
          tokenIndex: number
        ): string => {
          const registeredValue = _getEditableTextValue(tokenIndex)
          if (registeredValue !== undefined) {
            return registeredValue
          }
          if (typeof tok === 'string') {
            return tok
          }
          if (tok && typeof tok === 'object') {
            return ''
          }
          return ''
        }

        if (
          nextCursorIndex !== null &&
          newTokens.length > 0 &&
          nextCursorIndex < newTokens.length
        ) {
          savedCursorRef.current = {
            index: nextCursorIndex,
            offset: getTokenStringForOffset(
              newTokens[nextCursorIndex],
              nextCursorIndex
            ).length
          }
          programmaticCursorExpectationRef.current = savedCursorRef.current
          setCaretState(savedCursorRef.current)
        } else if (newTokens.length === 0) {
          savedCursorRef.current = null
          programmaticCursorExpectationRef.current = null
          setCaretState(null)
        } else if (
          newTokens.length > 0 &&
          (nextCursorIndex === null || nextCursorIndex >= newTokens.length)
        ) {
          const lastIdx = newTokens.length - 1
          savedCursorRef.current = {
            index: lastIdx,
            offset: getTokenStringForOffset(newTokens[lastIdx], lastIdx).length
          }
          programmaticCursorExpectationRef.current = savedCursorRef.current
          setCaretState(savedCursorRef.current)
        }
        return newTokens
      })
    },
    [
      tokens,
      onTokenFocus,
      setTokens,
      spacerChars,
      setSpacerChars,
      _getEditableTextValue,
      activeTokenRef,
      programmaticCursorExpectationRef,
      setCaretState
    ]
  )

  useInlayLayoutEffect<T>({
    tokens,
    restoreCursor,
    mainDivRef: ref,
    activeTokenRef,
    onTokenFocus: memoizedOnTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    domKeyRef,
    prevDomKeyValueRef,
    forceImmediateRestoreRef
  })

  const onBeforeInputEventHanlder = useBeforeInputHandler<T>({
    tokens,
    activeTokenRef,
    parseToken: memoizedParseToken,
    setTokens,
    savedCursorRef,
    mainDivRef: ref,
    spacerChars,
    setSpacerChars,
    programmaticCursorExpectationRef,
    lastOperationTypeRef,
    setCaretState
  })

  const onKeyDownEventHandler = useKeydownHandler<T>({
    tokens,
    setTokens,
    spacerChars,
    setSpacerChars,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    mainDivRef: ref,
    selectAllStateRef,
    parseToken: memoizedParseToken,
    removeToken: removeTokenScoped,
    saveCursor,
    onTokenFocus: memoizedOnTokenFocus,
    onCharInput: memoizedOnCharInput,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    displayCommitCharSpacer: memoizedDisplayCommitCharSpacer,
    _getEditableTextValue,
    forceImmediateRestoreRef,
    restoreCursor,
    history: inlayHistory,
    isRestoringHistoryRef,
    setCaretState,
    lastOperationTypeRef,
    multiline
  })

  useCopyHandler<T>({
    mainDivRef: ref,
    tokens,
    spacerChars,
    _getEditableTextValue
  })

  usePasteHandler<T>({
    mainDivRef: ref,
    tokens,
    setTokens,
    spacerChars,
    setSpacerChars,
    activeTokenRef,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef,
    parseToken: memoizedParseToken,
    removeToken: removeTokenScoped,
    _getEditableTextValue,
    onTokenFocus: memoizedOnTokenFocus,
    saveCursor,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit,
    insertSpacerOnCommit,
    displayCommitCharSpacer: memoizedDisplayCommitCharSpacer,
    forceImmediateRestoreRef,
    lastOperationTypeRef
  })

  React.useEffect(() => {
    if (!isSameCaret(caretState, savedCursorRef.current)) {
      savedCursorRef.current = caretState
      programmaticCursorExpectationRef.current = caretState
      if (caretState !== null) {
        forceImmediateRestoreRef.current = true
      }
    }
  }, [caretState, isSameCaret])

  const Comp = asChild ? Slot : 'div'

  const rootClassName = `inlay-root-${uniqueId.replace(/:/g, '')}`
  const combinedClassName = [className, rootClassName].filter(Boolean).join(' ')

  const onRootFocus = React.useCallback(() => {
    if (tokens.length === 0 && document.activeElement === ref.current) {
      const emptyToken = memoizedParseToken('')

      if (emptyToken !== null) {
        if (document.activeElement === ref.current) {
          ;(document.activeElement as HTMLElement).blur()
        }
        setTokens([emptyToken])
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const newTokenEl = ref.current?.querySelector('[data-token-id="0"]')
            if (newTokenEl) {
              const editableRegion = newTokenEl.querySelector(
                '[data-inlay-editable-region="true"]'
              ) as HTMLElement | null
              activeTokenRef.current = newTokenEl as HTMLElement
              onTokenFocus?.(0)
              const range = document.createRange()
              const sel = window.getSelection()
              if (editableRegion && editableRegion.firstChild) {
                editableRegion.focus()
                if (sel) {
                  if (editableRegion.firstChild.nodeType === Node.TEXT_NODE) {
                    range.setStart(editableRegion.firstChild, 0)
                    range.collapse(true)
                    sel.removeAllRanges()
                    sel.addRange(range)
                  }
                }
              } else if (editableRegion) {
                editableRegion.focus()
                if (sel) {
                  range.selectNodeContents(editableRegion)
                  range.collapse(true)
                  sel.removeAllRanges()
                  sel.addRange(range)
                }
              } else {
                ;(newTokenEl as HTMLElement).focus()
                if (sel && newTokenEl.firstChild) {
                  range.selectNodeContents(newTokenEl)
                  range.collapse(true)
                  sel.removeAllRanges()
                  sel.addRange(range)
                }
              }
              savedCursorRef.current = { index: 0, offset: 0 }
              if (!isSameCaret({ index: 0, offset: 0 }, caretState)) {
                setCaretState({ index: 0, offset: 0 })
              }
              newTokenEl.getBoundingClientRect()
            }
          })
        })
      }
    }
  }, [
    tokens,
    ref,
    activeTokenRef,
    memoizedParseToken,
    setTokens,
    savedCursorRef,
    isSameCaret,
    caretState,
    setCaretState,
    onTokenFocus
  ])

  return (
    <InlayProvider
      scope={__scope}
      onTokenChange={memoizedOnTokenChange as any}
      activeTokenRef={activeTokenRef}
      tokens={tokens as any}
      onInput={onDivInput}
      updateToken={updateToken as any}
      parseToken={memoizedParseToken as any}
      removeToken={removeTokenScoped as any}
      restoreCursor={restoreCursor}
      saveCursor={saveCursor}
      spacerChars={spacerChars}
      displayCommitCharSpacer={memoizedDisplayCommitCharSpacer}
      renderSpacer={renderSpacer}
      onCharInput={memoizedOnCharInput as any}
      _registerEditableTextValue={_registerEditableTextValue}
      _getEditableTextValue={_getEditableTextValue}
    >
      <Comp
        contentEditable
        suppressContentEditableWarning
        onInput={onDivInput}
        onBeforeInput={onBeforeInputEventHanlder}
        onKeyDown={onKeyDownEventHandler}
        onFocus={onRootFocus}
        ref={composeRefs(forwardedRef, ref)}
        style={{
          ...style,
          position: 'relative',
          caretColor: 'transparent',
          ...(multiline && { whiteSpace: 'pre-wrap' })
        }}
        className={combinedClassName}
        {...props}
      >
        {children}
      </Comp>
    </InlayProvider>
  )
}

const InlayToken = React.forwardRef<
  HTMLDivElement,
  ScopedProps<InlayTokenProps>
>(
  (
    {
      index,
      children,
      asChild,
      __scope,
      editable = false,
      captureSelectAll = false
    },
    forwardedRef
  ) => {
    const ref = React.useRef<HTMLDivElement>(null)
    const {
      activeTokenRef,
      renderSpacer: contextRenderSpacer,
      tokens,
      spacerChars: contextSpacerChars
    } = useInlayContext(COMPONENT_NAME, __scope)

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
          data-capture-select-all={captureSelectAll}
          contentEditable={isEffectivelyEditable}
          suppressContentEditableWarning
          onBeforeInput={() => {
            // const event = e.nativeEvent as InputEvent
            // console.log(...)
          }}
        >
          {displayContent}
        </Comp>
        {index < tokens.length - 1 &&
          contextSpacerChars &&
          contextSpacerChars[index] &&
          contextRenderSpacer(contextSpacerChars[index]!, index)}
      </>
    )
  }
)

InlayToken.displayName = 'InlayToken'

type InlayTokenEditableText = {
  value?: string
  index: number
} & Omit<React.HTMLAttributes<HTMLElement>, 'onChange' | 'onFocus' | 'onInput'>

const InlayTokenEditableText = React.forwardRef<
  HTMLElement,
  ScopedProps<InlayTokenEditableText>
>(({ value, index, __scope, ...props }, forwardedRef) => {
  const { _registerEditableTextValue } = useInlayContext(
    COMPONENT_NAME,
    __scope
  )

  React.useEffect(() => {
    const actualValue = value === undefined || value === '' ? '' : value
    _registerEditableTextValue(index, actualValue)
    return () => {
      _registerEditableTextValue(index, null)
    }
  }, [value, index, _registerEditableTextValue])

  const displayValue = value === undefined || value === '' ? ZWS : value
  return (
    <span
      data-inlay-editable-region="true"
      ref={forwardedRef}
      {...props}
      style={{
        display: 'inline',
        minHeight: '1em',
        minWidth: '1px',
        caretColor: 'auto',
        ...props.style
      }}
    >
      {displayValue}
    </span>
  )
})

InlayTokenEditableText.displayName = 'InlayTokenEditableText'

export function createInlay<T>() {
  const Root = React.forwardRef(_Inlay<T>)
  return {
    Root,
    Token: InlayToken as React.ForwardRefExoticComponent<
      InlayTokenProps & React.RefAttributes<HTMLDivElement>
    >,
    EditableText: InlayTokenEditableText,
    __type: null as unknown as T
  } as const
}
export type InferInlay<T> = T extends { __type: infer U } ? U : never

export const { Root, Token, EditableText } = createInlay<string>()
