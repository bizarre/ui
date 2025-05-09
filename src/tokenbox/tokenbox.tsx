import * as React from 'react'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { Slot } from '@radix-ui/react-slot'
import { ScopedProps } from '../types'

const COMPONENT_NAME = 'TokenBox'

const [createTokenBoxContext] = createContextScope(COMPONENT_NAME)

type TokenBoxContextValue = {
  onTokenChange?: (key: string, value: string) => void
  onTokenFocus?: (key: string | null) => void
  activeTokenRef: React.RefObject<HTMLElement | null>
  tokens: Record<string, string>
  updateToken: ({ key, value }: { key?: string; value?: string }) => void
  removeToken: (key: string) => void
  bufferRef: React.RefObject<HTMLElement | null>
  setBufferPropValue: (value: string) => void
  setVirtualBufferValue: (value: string) => void
  bufferPropValue: string
  virtualBufferValue: string
  saveCursor: () => void
  restoreCursor: () => void
}

const [TokenBoxProvider, useTokenBoxContext] =
  createTokenBoxContext<TokenBoxContextValue>(COMPONENT_NAME)

type TokenBoxProps = {
  children: React.ReactNode
  asChild?: boolean
  onTokenChange?: (key: string, value: string) => void
  onTokensChange?: (tokens: Record<string, string>) => void
  onTokenFocus?: (key: string | null) => void
  tokens?: Record<string, string>
  defaultTokens?: Record<string, string>
} & React.HTMLAttributes<HTMLElement>

const TokenBox = React.forwardRef<HTMLElement, ScopedProps<TokenBoxProps>>(
  (
    {
      children,
      asChild,
      __scope,
      onTokenChange,
      onTokensChange,
      onTokenFocus,
      tokens: tokensProp,
      defaultTokens,
      ...props
    },
    forwardedRef
  ) => {
    const ref = React.useRef<HTMLDivElement>(null)
    const bufferRef = React.useRef<HTMLElement>(null)
    const activeTokenRef = React.useRef<HTMLElement>(null)
    const [version, setVersion] = React.useState(0)
    const [bufferValue, setBufferPropValue] = React.useState('')
    const [virtualBufferValue, setVirtualBufferValue] = React.useState('')

    const forceSync = () => {
      console.log('forceSync')
      setVersion((v) => v + 1)
    }

    const [tokens, setTokens] = useControllableState({
      prop: tokensProp,
      defaultProp: defaultTokens ?? {},
      onChange: onTokensChange
    })

    // Save caret position as logical token ID + offset
    const savedCursorRef = React.useRef<{
      tokenId: string | null
      offset: number
    } | null>(null)

    React.useEffect(() => {
      const handleSelectionChange = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) {
          activeTokenRef.current = null
          onTokenFocus?.(null)
          return
        }

        const range = sel.getRangeAt(0)
        const container = range.startContainer

        const tokenEl =
          container.nodeType === Node.ELEMENT_NODE
            ? (container as HTMLElement)
            : (container.parentElement?.closest(
                '[data-token-id]'
              ) as HTMLElement | null)

        const tokenId = tokenEl?.getAttribute('data-token-id')
        if (tokenId) {
          onTokenFocus?.(tokenId)
          activeTokenRef.current = tokenEl
        } else {
          onTokenFocus?.(null)
          activeTokenRef.current = null
        }
      }

      document.addEventListener('selectionchange', handleSelectionChange)
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange)
      }
    }, [onTokenFocus])

    const saveCursor = React.useCallback((offsetHint?: number) => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const container = range.startContainer
      const offset = offsetHint ?? range.startOffset

      const tokenEl =
        container.nodeType === Node.ELEMENT_NODE
          ? (container as HTMLElement)
          : (container.parentElement?.closest(
              '[data-token-id]'
            ) as HTMLElement | null)

      if (tokenEl) {
        const tokenId = tokenEl.getAttribute('data-token-id')
        if (tokenId) {
          savedCursorRef.current = { tokenId, offset }
        }
      } else if (container.parentElement === bufferRef.current) {
        savedCursorRef.current = { tokenId: null, offset }
      }

      console.log('saveCursor', savedCursorRef.current)
    }, [])

    const restoreCursor = React.useCallback(() => {
      const sel = window.getSelection()
      if (!sel || !ref.current) return

      const saved = savedCursorRef.current
      if (!saved) return

      let element
      if (!saved.tokenId && bufferRef.current) {
        element = bufferRef.current.firstChild
      } else if (saved.tokenId) {
        element = ref.current.querySelector(
          `[data-token-id="${saved.tokenId}"]`
        )?.firstChild
      }

      if (!element) return

      const range = document.createRange()
      const textNode = element
      const safeOffset = Math.min(
        saved.offset,
        textNode.textContent?.length ?? 0
      )

      console.log('restoreCursor', saved, safeOffset)

      range.setStart(textNode, safeOffset)
      range.collapse(true)

      sel.removeAllRanges()
      sel.addRange(range)
    }, [bufferValue])

    React.useEffect(() => {
      if (!bufferRef.current) return
      console.log('bufferRef.current', bufferRef.current)

      // Only update textContent if it has changed
      if (bufferRef.current.textContent !== bufferValue) {
        console.log(
          'valueRef.current.textContent !== value',
          bufferRef.current.textContent,
          bufferValue
        )

        saveCursor(bufferValue.length)
        if (bufferValue === '') {
          bufferRef.current.textContent = '\u200B'
        } else {
          bufferRef.current.textContent = bufferValue
        }

        restoreCursor()
      }
    }, [bufferValue, saveCursor, restoreCursor, version])

    const onInput = React.useCallback(() => {
      if (activeTokenRef.current) return
      setVirtualBufferValue(bufferRef.current?.textContent || '')
      forceSync()
    }, [forceSync, saveCursor, bufferValue])

    const onFocus = React.useCallback(() => {
      const el = bufferRef.current
      if (!el) return

      // Inject a zero-width space if the element is empty
      if (!el.textContent) {
        el.textContent = '\u200B'
      }

      el.focus()

      const range = document.createRange()
      const sel = window.getSelection()
      const textNode = el.firstChild
      const length = textNode?.textContent?.length ?? 0

      if (textNode && sel) {
        range.setStart(textNode, length)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        console.log('onFocus', el)
      }
    }, [bufferValue])

    const handleRemoveTokenOnKeyDown = (
      e: React.KeyboardEvent<HTMLDivElement>
    ) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return

      if (activeTokenRef.current && !activeTokenRef.current.isContentEditable) {
        console.log('activeTokenRef.current', activeTokenRef.current)
        e.preventDefault()
        removeToken(activeTokenRef.current.getAttribute('data-token-id')!)
      }

      console.log('handleRemoveTokenOnKeyDown', e.key)

      let container
      let offset
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        container = sel.getRangeAt(0).startContainer
        offset = sel.getRangeAt(0).startOffset

        if (container.parentElement === bufferRef.current) {
          offset = bufferValue.length
        }
      } else {
        return
      }

      console.log('container, offset', container, offset)

      let tokenEl: HTMLElement | null = null

      if (e.key === 'Backspace') {
        if (offset === 0 && container.previousSibling instanceof HTMLElement) {
          const sibling = container.previousSibling
          console.log('sibling', sibling)
          if (sibling.hasAttribute('data-token-id')) {
            tokenEl = sibling
          }
        } else if (
          offset === 0 &&
          container.parentElement?.previousElementSibling instanceof HTMLElement
        ) {
          const sibling = container.parentElement?.previousElementSibling
          console.log('sibling', sibling)
          if (sibling.hasAttribute('data-token-id')) {
            tokenEl = sibling
          }
        }
      }

      if (e.key === 'Delete') {
        if (
          container.nodeType === Node.TEXT_NODE &&
          offset === container.textContent?.length &&
          container.nextSibling instanceof HTMLElement
        ) {
          const sibling = container.nextSibling
          if (sibling.hasAttribute('data-token-id')) {
            tokenEl = sibling
          }
        } else if (
          container instanceof HTMLElement &&
          offset < container.childNodes.length &&
          container.childNodes[offset] instanceof HTMLElement
        ) {
          const maybeToken = container.childNodes[offset] as HTMLElement
          if (maybeToken.hasAttribute('data-token-id')) {
            tokenEl = maybeToken
          }
        }
      }

      if (tokenEl) {
        const tokenId = tokenEl.getAttribute('data-token-id')
        if (tokenId) {
          e.preventDefault()

          if (!tokenEl.isContentEditable) {
            removeToken(tokenId)
          }
        }
        return
      }

      if (container.parentElement === bufferRef.current && offset === 1) {
        e.preventDefault()
        setVirtualBufferValue('')
        forceSync()
      }
    }

    const handleAugmentedInputOnKeyDown = (
      e: React.KeyboardEvent<HTMLDivElement>
    ) => {
      if (e.defaultPrevented) return
      if (activeTokenRef.current) return

      if (bufferRef.current) {
        bufferRef.current.focus()
      }
    }

    const updateToken = React.useCallback(
      ({ key, value }: { key?: string; value?: string }) => {
        console.log('addToken', key, value)
        setTokens((prev) => ({
          ...prev,
          [key || Object.keys(prev).length + 1]: value || ''
        }))
      },
      [setTokens]
    )

    const removeToken = React.useCallback(
      (key: string) => {
        setTokens((prev) => {
          const newTokens = { ...prev }
          delete newTokens[key]
          return newTokens
        })
      },
      [setTokens]
    )

    const Comp = asChild ? Slot : 'div'

    return (
      <TokenBoxProvider
        scope={__scope}
        onTokenChange={onTokenChange}
        activeTokenRef={activeTokenRef}
        tokens={tokens}
        updateToken={updateToken}
        removeToken={removeToken}
        bufferRef={bufferRef}
        setVirtualBufferValue={setVirtualBufferValue}
        virtualBufferValue={virtualBufferValue}
        setBufferPropValue={setBufferPropValue}
        bufferPropValue={bufferValue}
        restoreCursor={restoreCursor}
        saveCursor={saveCursor}
      >
        <Comp
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onKeyDown={(e) => {
            handleRemoveTokenOnKeyDown(e)
            handleAugmentedInputOnKeyDown(e)
          }}
          onFocus={onFocus}
          ref={composeRefs(forwardedRef, ref)}
          {...props}
        >
          {children}
        </Comp>
      </TokenBoxProvider>
    )
  }
)

type TokenBoxTokenBufferProps = {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  createTokenOnSpace?: boolean
  createToken?: (value: string) => boolean
}

const TokenBoxTokenBuffer = React.forwardRef<
  HTMLElement,
  ScopedProps<TokenBoxTokenBufferProps>
>(
  (
    {
      value: valueProp,
      defaultValue,
      onChange,
      __scope,
      createTokenOnSpace = true,
      createToken
    },
    forwardedRef
  ) => {
    const {
      bufferRef,
      setBufferPropValue,
      virtualBufferValue,
      setVirtualBufferValue,
      updateToken
    } = useTokenBoxContext(COMPONENT_NAME, __scope)
    const ref = React.useRef<HTMLDivElement>(null)

    const [value, setValue] = useControllableState({
      prop: valueProp,
      defaultProp: defaultValue || '',
      onChange
    })

    React.useEffect(() => {
      const endsWithSpace = /\s/.test(valueProp?.slice(-1) || '')
      const startsWithSpace = /\s/.test(valueProp?.slice(0, 1) || '')
      const containsNonSpace = /\S/.test(valueProp || '')
      console.log(
        'createTokenOnSpace',
        createTokenOnSpace,
        valueProp,
        endsWithSpace,
        startsWithSpace,
        containsNonSpace
      )
      if (
        createTokenOnSpace &&
        valueProp &&
        valueProp.length > 1 &&
        endsWithSpace &&
        (!startsWithSpace || containsNonSpace)
      ) {
        setBufferPropValue('')
        setVirtualBufferValue('')
        updateToken({ value: valueProp })
      } else if (createToken) {
        if (valueProp && createToken?.(valueProp)) {
          setBufferPropValue('')
          setVirtualBufferValue('')
          updateToken({ value: valueProp })
        }
      } else {
        setBufferPropValue(valueProp || '')
      }
    }, [valueProp])

    React.useLayoutEffect(() => {
      if (virtualBufferValue !== value) {
        setValue(virtualBufferValue.replaceAll('\u200B', ''))
      }
    }, [value, virtualBufferValue])

    return <span ref={composeRefs(bufferRef, ref, forwardedRef)}></span>
  }
)

type TokenBoxTokenProps = {
  id: string
  children: React.ReactNode
  asChild?: boolean
  editable?: boolean
}

const TokenBoxToken = React.forwardRef<
  HTMLDivElement,
  ScopedProps<TokenBoxTokenProps>
>(({ id, children, asChild, __scope, editable = false }, forwardedRef) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const {
    onTokenChange,
    updateToken,
    removeToken,
    saveCursor,
    restoreCursor,
    activeTokenRef
  } = useTokenBoxContext(COMPONENT_NAME, __scope)

  React.useEffect(() => {
    updateToken({ key: id, value: ref.current?.textContent || '' })
    return () => {
      removeToken(id)
    }
  }, [updateToken, children, id, removeToken])

  React.useEffect(() => {
    if (!ref.current) return

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log('mutation', mutation)
        saveCursor()
        updateToken({ key: id, value: mutation.target.textContent || '' })
      })
    })

    observer.observe(ref.current, {
      childList: true,
      characterData: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
    }
  }, [ref, onTokenChange, id])

  React.useEffect(() => {
    if (!activeTokenRef.current) return
    if (activeTokenRef.current !== ref.current) return

    restoreCursor()
  }, [children])

  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      ref={composeRefs(forwardedRef, ref)}
      data-token-id={id}
      contentEditable={editable}
    >
      {children}
    </Comp>
  )
})

export {
  TokenBox as Root,
  TokenBoxToken as Token,
  TokenBoxTokenBuffer as Buffer
}
