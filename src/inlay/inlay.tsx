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
  InlayTokenProps
} from './inlay.types'
import { useBeforeInputHandler } from './hooks/useBeforeInputHandler'
import { useKeydownHandler } from './hooks/useKeydownHandler'
import { processRootText } from './utils/process-root-text'
import { useInlayLayoutEffect } from './hooks/useInlayLayoutEffect'
import { useSelectionChangeHandler } from './hooks/useSelectionChangeHandler'

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
    parse: parseToken,
    commitOnChars,
    defaultNewTokenValue,
    addNewTokenOnCommit = true,
    insertSpacerOnCommit = true,
    displayCommitCharSpacer = false,
    onInput: onCharInput,
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

  // For EditableText integration: Map of tokenIndex -> string value
  const editableTextValuesRef = React.useRef<{
    [index: number]: string | undefined
  }>({})

  const _registerEditableTextValue = React.useCallback(
    (index: number, text: string | null) => {
      if (text === null) {
        delete editableTextValuesRef.current[index]
      } else {
        editableTextValuesRef.current[index] = text
      }
      // console.log('[_registerEditableTextValue] Updated map:', index, text, editableTextValuesRef.current);
    },
    []
  )

  const _getEditableTextValue = React.useCallback(
    (index: number): string | undefined => {
      return editableTextValuesRef.current[index]
    },
    []
  )

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
    if (spacerChars.length !== tokens.length) {
      setSpacerChars(Array(tokens.length).fill(null))
    }
  }, [tokens.length, spacerChars.length])

  const savedCursorRef = React.useRef<{
    index: number
    offset: number
  } | null>(null)

  useSelectionChangeHandler({
    mainDivRef: ref,
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    selectAllStateRef
  })

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
      const tokenIdStr = tokenEl.getAttribute('data-token-id')
      if (tokenIdStr) {
        const tokenIndex = parseInt(tokenIdStr)
        let finalOffset = offset // Default to the raw offset from selection

        const editableRegion = tokenEl.querySelector(
          '[data-inlay-editable-region="true"]'
        ) as HTMLElement | null

        if (editableRegion) {
          const editableRegionText = editableRegion.textContent || ''
          if (
            container === editableRegion ||
            editableRegion.contains(container)
          ) {
            // Selection is within or on the editable region itself
            // The `offset` from `sel.getRangeAt(0)` is already relative to the container (e.g., TextNode within editableRegion)
            // Ensure it's clamped to the actual text length of the region
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
            // Selection is on the main token element, but an editable region exists
            // Default to offset 0 within the editable region if it's empty (showing ZWS),
            // or end of text if it has content (though focus should ideally be inside)
            finalOffset =
              editableRegionText === ZWS ? 0 : editableRegionText.length
          } else {
            // Selection is outside tokenEl or editableRegion (should not happen if tokenEl is the closest)
            // Or, container is some other child of tokenEl not in editableRegion. Fallback.
            finalOffset =
              editableRegionText === ZWS ? 0 : editableRegionText.length
          }
        } else {
          // No editable region, it's a simple token (e.g. just text content in tokenEl)
          if (container === tokenEl) {
            finalOffset = (tokenEl.textContent || '').length
          } else if (tokenEl.contains(container)) {
            // Ensure offset is clamped if container is a text node inside tokenEl
            finalOffset = Math.min(offset, (container.textContent || '').length)
          } else {
            // Fallback for simple token if selection is weirdly outside
            finalOffset = (tokenEl.textContent || '').length
          }
        }

        savedCursorRef.current = {
          index: tokenIndex,
          offset: finalOffset
        }
        console.log('[saveCursor] Saved:', savedCursorRef.current)
        return
      }
    }
    savedCursorRef.current = null
    console.log('[saveCursor] Cleared saved cursor (no tokenEl or tokenId)')
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

      let targetNodeForCursor: Node | null = null
      let effectiveOffset = saved.offset

      // Try to find the designated editable text container
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
          // Empty editable region, collapse to the region itself
          targetNodeForCursor = editableRegion
          effectiveOffset = 0
        } else {
          console.warn(
            '[restoreCursor] Editable text region found, but it does not contain a direct text node or is not empty as expected. Collapsing to region start.'
          )
          targetNodeForCursor = editableRegion
          effectiveOffset = 0
        }
      } else if (
        element.firstChild &&
        element.firstChild.nodeType === Node.TEXT_NODE
      ) {
        // Original logic for simple string tokens (direct text node child of the token span)
        targetNodeForCursor = element.firstChild
        effectiveOffset = Math.min(
          saved.offset,
          (element.firstChild.textContent || '').length
        )
      } else if (textContent === '' && saved.offset === 0) {
        // Handle completely empty token (no specific region, no text)
        targetNodeForCursor = element
        effectiveOffset = 0
      } else {
        // Last resort: collapse to the start of the main token element
        console.warn(
          '[restoreCursor] Complex token without a designated editable region or direct text node. Collapsing to start of token element.'
        )
        targetNodeForCursor = element
        effectiveOffset = 0
      }

      if (targetNodeForCursor) {
        try {
          if (targetNodeForCursor.nodeType === Node.TEXT_NODE) {
            range.setStart(targetNodeForCursor, effectiveOffset)
            range.collapse(true)
          } else if (targetNodeForCursor.nodeType === Node.ELEMENT_NODE) {
            // If it's an element (e.g., empty editableRegion or empty token element),
            // select its contents and collapse to the start. This is suitable for making it focusable.
            range.selectNodeContents(targetNodeForCursor)
            range.collapse(true)
          } else {
            // Should not happen with the logic above
            console.error(
              '[restoreCursor] Target node is not Text or Element. Cannot set range.'
            )
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
        console.error(
          '[restoreCursor] Could not determine a target node for cursor placement.'
        )
        return // Exit if no target node determined
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
    saveCursor()

    requestAnimationFrame(() => {
      let elementToProcess = initiallySelectedTokenElementForRAF

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
      console.log('removeTokenScoped', index)

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
            nextCursorIndex = 0 // Was 0, should remain 0 if first token is removed and others exist
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

        // Helper function to get the string representation for offset calculation
        const getTokenStringForOffset = (
          tok: T,
          tokenIndex: number
        ): string => {
          // First, try to get value from registered EditableText components
          const registeredValue = _getEditableTextValue(tokenIndex)
          if (registeredValue !== undefined) {
            return registeredValue // This is the most reliable source if available
          }

          // Fallback if not registered (e.g., simple string token or complex token not using EditableText)
          if (typeof tok === 'string') {
            return tok
          }
          if (tok && typeof tok === 'object') {
            // This object case without a registered EditableText value is inherently ambiguous.
            // Previously, we tried to guess based on 'username'.
            // Now, it's better to warn and return empty, or rely on a user-provided general stringifier if we had one.
            console.warn(
              `[getTokenStringForOffset] Token at index ${tokenIndex} is an object but has no registered EditableText value. Returning empty string.`,
              tok
            )
            return '' // Default for unhandled objects without registered EditableText
          }
          return '' // Default for null/undefined tokens
        }

        if (
          nextCursorIndex !== null &&
          newTokens.length > 0 &&
          nextCursorIndex < newTokens.length
        ) {
          savedCursorRef.current = {
            index: nextCursorIndex,
            offset: getTokenStringForOffset(
              tokens[nextCursorIndex],
              nextCursorIndex
            ).length
          }
        } else if (newTokens.length === 0) {
          savedCursorRef.current = null
        } else if (
          newTokens.length > 0 &&
          (nextCursorIndex === null || nextCursorIndex >= newTokens.length)
        ) {
          savedCursorRef.current = {
            index: newTokens.length - 1,
            offset: getTokenStringForOffset(
              newTokens[newTokens.length - 1],
              newTokens.length - 1
            ).length
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

  useInlayLayoutEffect<T>({
    tokens,
    restoreCursor,
    mainDivRef: ref, // Pass the main div ref
    activeTokenRef,
    onTokenFocus,
    savedCursorRef,
    programmaticCursorExpectationRef,
    domKeyRef,
    prevDomKeyValueRef
  })

  // Call the useBeforeInputHandler hook
  const onBeforeInputEventHanlder = useBeforeInputHandler<T>({
    tokens,
    activeTokenRef,
    parseToken, // This is parseToken from _Inlay's props
    setTokens,
    savedCursorRef,
    mainDivRef: ref,
    spacerChars,
    setSpacerChars,
    programmaticCursorExpectationRef
  })

  // Call the new useKeydownHandler hook
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
    parseToken, // from _Inlay props
    removeToken: removeTokenScoped, // Use the scoped removeToken
    saveCursor, // from _Inlay scope
    onTokenFocus, // from _Inlay props
    onCharInput, // from _Inlay props
    commitOnChars, // from _Inlay props
    defaultNewTokenValue, // from _Inlay props
    addNewTokenOnCommit, // from _Inlay props (already has default)
    insertSpacerOnCommit, // from _Inlay props (already has default)
    displayCommitCharSpacer, // from _Inlay props
    _getEditableTextValue // Pass down from _Inlay context functions
  })

  const Comp = asChild ? Slot : 'div'

  return (
    <InlayProvider
      scope={__scope}
      onTokenChange={onTokenChange as any}
      activeTokenRef={activeTokenRef}
      tokens={tokens as any}
      onInput={onDivInput}
      updateToken={updateToken as any}
      parseToken={parseToken as any}
      removeToken={removeTokenScoped as any}
      restoreCursor={restoreCursor}
      saveCursor={saveCursor}
      spacerChars={spacerChars}
      displayCommitCharSpacer={displayCommitCharSpacer}
      renderSpacer={renderSpacer}
      onCharInput={onCharInput as any}
      _registerEditableTextValue={_registerEditableTextValue}
      _getEditableTextValue={_getEditableTextValue}
    >
      <Comp
        contentEditable
        suppressContentEditableWarning
        onInput={onDivInput}
        onBeforeInput={onBeforeInputEventHanlder}
        onKeyDown={onKeyDownEventHandler}
        ref={composeRefs(forwardedRef, ref)}
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
>(({ index, children, asChild, __scope, editable = false }, forwardedRef) => {
  const ref = React.useRef<HTMLDivElement>(null)
  console.log(
    '[InlayToken] Rendering token at index:',
    index,
    'With children:',
    children
  )
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

type TokenEditableTextProps = {
  value?: string
  index: number
} & Omit<React.HTMLAttributes<HTMLElement>, 'onChange' | 'onFocus' | 'onInput'>

const EditableText = ({
  value,
  index,
  __scope,
  ...props
}: ScopedProps<TokenEditableTextProps>) => {
  const { _registerEditableTextValue } = useInlayContext(
    COMPONENT_NAME,
    __scope
  )

  React.useEffect(() => {
    const actualValue = value === undefined || value === '' ? '' : value // Store empty string, not ZWS
    _registerEditableTextValue(index, actualValue)
    return () => {
      _registerEditableTextValue(index, null) // Unregister on unmount
    }
  }, [value, index, _registerEditableTextValue])

  // Render ZWS if value is empty or undefined to ensure the span is focusable and has height
  const displayValue = value === undefined || value === '' ? ZWS : value
  return (
    <span
      data-inlay-editable-region="true"
      {...props}
      style={{
        display: 'inline-block',
        minHeight: '1em',
        minWidth: '1px',
        ...props.style
      }}
    >
      {displayValue}
    </span>
  )
}
EditableText.displayName = 'InlayEditableText'

export function createInlay<T>() {
  const Root = React.forwardRef(_Inlay<T>)
  return {
    Root,
    Token: InlayToken as React.ForwardRefExoticComponent<
      InlayTokenProps & React.RefAttributes<HTMLDivElement>
    >,
    EditableText,
    __type: null as unknown as T
  } as const
}
export type InferInlay<T> = T extends { __type: infer U } ? U : never

export const {
  Root,
  Token,
  EditableText: InlayEditableText
} = createInlay<string>()
