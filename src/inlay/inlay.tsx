import type { Scope } from '@radix-ui/react-context'
import { createContextScope } from '@radix-ui/react-context'
import * as Popover from '@radix-ui/react-popover'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import React, {
  createContext,
  useCallback,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  getAbsoluteOffset,
  setDomSelection,
  serializeRawFromDom as serializeFromDom
} from './internal/dom-utils'
import { useHistory } from './hooks/use-history'
import { useSelection } from './hooks/use-selection'
import { useTokenWeaver } from './hooks/use-token-weaver'
import { useComposition } from './hooks/use-composition'
import { useKeyHandlers } from './hooks/use-key-handlers'
import { usePlaceholderSync } from './hooks/use-placeholder-sync'
import { useSelectionSnap } from './hooks/use-selection-snap'
import {
  PortalList,
  PortalItem,
  type PortalKeyboardHandler
} from './portal-list'
import { useClipboard } from './hooks/use-clipboard'
import { useVirtualKeyboard } from './hooks/use-virtual-keyboard'
import { useTouchSelection } from './hooks/use-touch-selection'

export const COMPONENT_NAME = 'Inlay'
export const TEXT_COMPONENT_NAME = 'Inlay.Text'

export type ScopedProps<P> = P & { __scope?: Scope }
const [createInlayContext] = createContextScope(COMPONENT_NAME)

const AncestorContext = createContext<React.ReactElement | null>(null)
const PopoverControlContext = createContext<{
  setOpen: (open: boolean) => void
} | null>(null)

// Context for portal keyboard navigation
type PortalKeyboardContextValue = {
  setHandler: (handler: PortalKeyboardHandler | null) => void
}
const PortalKeyboardContext = createContext<PortalKeyboardContextValue | null>(
  null
)
export { PortalKeyboardContext }

function annotateWithAncestor(
  node: React.ReactNode,
  currentAncestor: React.ReactElement | null
): React.ReactNode {
  if (!React.isValidElement(node)) {
    return node
  }

  const element = node as React.ReactElement<{ children?: React.ReactNode }>
  const nextAncestor = currentAncestor ?? element

  const children = element.props.children
  const wrappedChildren = React.Children.map(
    children,
    (child: React.ReactNode) => annotateWithAncestor(child, nextAncestor)
  )

  return (
    <AncestorContext.Provider value={nextAncestor}>
      {React.cloneElement(element, undefined, wrappedChildren)}
    </AncestorContext.Provider>
  )
}

// --- Internal Context for token registration ---
type InternalInlayContextValue = {
  registerToken: (token: { text: string; node: React.ReactElement }) => void
}
const [InternalInlayProvider, useInternalInlayContext] =
  createInlayContext<InternalInlayContextValue>(COMPONENT_NAME)

// --- Public Context for consumer state ---
type TokenInfo = {
  text: string
  node: React.ReactElement
  start: number
  end: number
}

export type TokenState = {
  isCollapsed: boolean
  isAtStartOfToken: boolean
  isAtEndOfToken: boolean
}

type PublicInlayContextValue = {
  value: string
  selection: { start: number; end: number }
  activeToken: TokenInfo | null
  activeTokenState: TokenState | null
  getSelectionRange: () => Range | null
}

const [PublicInlayProvider, usePublicInlayContext] =
  createInlayContext<PublicInlayContextValue>(COMPONENT_NAME)

export type InlayProps = ScopedProps<
  {
    children: React.ReactNode
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    placeholder?: React.ReactNode
    multiline?: boolean
    // Mobile input attributes
    inputMode?:
      | 'text'
      | 'search'
      | 'email'
      | 'tel'
      | 'url'
      | 'numeric'
      | 'decimal'
      | 'none'
    autoCapitalize?:
      | 'off'
      | 'none'
      | 'on'
      | 'sentences'
      | 'words'
      | 'characters'
    autoCorrect?: 'on' | 'off'
    enterKeyHint?:
      | 'enter'
      | 'done'
      | 'go'
      | 'next'
      | 'previous'
      | 'search'
      | 'send'
    onVirtualKeyboardChange?: (open: boolean) => void
  } & Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'onKeyDown'
  > & {
      onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => boolean // Return true to stop propagation
    } & {
      getPopoverAnchorRect?: (root: HTMLDivElement | null) => DOMRect
    }
>

export type InlayRef = {
  root: HTMLDivElement | null
  setSelection: (start: number, end?: number) => void
}

const Inlay = React.forwardRef<InlayRef, InlayProps>((props, forwardedRef) => {
  const {
    __scope,
    children: allChildren,
    value: valueProp,
    defaultValue,
    onChange,
    onKeyDown: onKeyDownProp,
    placeholder,
    multiline = true,
    getPopoverAnchorRect,
    // Mobile input attributes
    inputMode = 'text',
    autoCapitalize = 'sentences',
    autoCorrect, // Omit by default - let iOS use native behavior (single-word suggestions)
    enterKeyHint,
    onVirtualKeyboardChange,
    ...inlayProps
  } = props

  const popoverPortal = React.useMemo(
    () =>
      React.Children.toArray(allChildren).find(
        (child) => React.isValidElement(child) && child.type === Portal
      ),
    [allChildren]
  )

  const children = React.useMemo(
    () =>
      React.Children.toArray(allChildren).filter(
        (child) => !React.isValidElement(child) || child.type !== Portal
      ),
    [allChildren]
  )

  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Portal keyboard handler - allows Portal.List to intercept keyboard events
  const portalKeyboardHandlerRef = useRef<PortalKeyboardHandler | null>(null)
  const portalKeyboardContext = useMemo(
    () => ({
      setHandler: (handler: PortalKeyboardHandler | null) => {
        portalKeyboardHandlerRef.current = handler
      }
    }),
    []
  )
  const lastAnchorRectRef = useRef<DOMRect>(new DOMRect(0, 0, 0, 0))
  const virtualAnchorRef = useRef({
    getBoundingClientRect: () => lastAnchorRectRef.current
  })
  const customAnchorRef = useRef({
    getBoundingClientRect: () => new DOMRect(0, 0, 0, 0)
  })
  useLayoutEffect(() => {
    if (!getPopoverAnchorRect) return
    customAnchorRef.current.getBoundingClientRect = () => {
      try {
        const root = editorRef.current
        const rect = getPopoverAnchorRect(root)
        return rect ?? new DOMRect(0, 0, 0, 0)
      } catch {
        return new DOMRect(0, 0, 0, 0)
      }
    }
  }, [getPopoverAnchorRect])
  const chosenAnchorRef = getPopoverAnchorRect
    ? customAnchorRef
    : virtualAnchorRef
  const popoverControl = useMemo(() => ({ setOpen: setIsPopoverOpen }), [])
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue || '',
    onChange
  })
  // Keep a ref to the current value for synchronous access in event handlers
  const valueRef = useRef(value)
  valueRef.current = value
  const editorRef = useRef<HTMLDivElement | null>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const {
    selection,
    setSelection,
    setSelectionImperative,
    handleSelectionChange,
    suppressNextSelectionAdjustRef
  } = useSelection(editorRef, value)
  const {
    isRegistered,
    registerToken,
    weavedChildren,
    activeToken,
    activeTokenRef,
    activeTokenState
  } = useTokenWeaver(value, selection, multiline, children)

  const lastArrowDirectionRef = useRef<'left' | 'right' | 'up' | 'down' | null>(
    null
  )
  const lastShiftRef = useRef(false)

  const getCurrentSnapshot = useCallback(() => {
    const root = editorRef.current
    if (root) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0)
        const start = getAbsoluteOffset(root, r.startContainer, r.startOffset)
        const end = getAbsoluteOffset(root, r.endContainer, r.endOffset)
        return { value, selection: { start, end } }
      }
    }
    return { value, selection }
  }, [value, selection])
  const applySnapshot = useCallback(
    (snap: { value: string; selection: { start: number; end: number } }) => {
      setValue(() => snap.value)
      requestAnimationFrame(() => {
        const root = editorRef.current
        if (root) {
          suppressNextSelectionAdjustRef.current = true
          setDomSelection(root, snap.selection.start, snap.selection.end)
        }
      })
    },
    [setValue]
  )
  const { pushUndoSnapshot, beginEditSession, endEditSession, undo, redo } =
    useHistory(getCurrentSnapshot, applySnapshot, 200)

  const serializeRawFromDom = useCallback((): string => {
    const root = editorRef.current
    if (!root) return value
    return serializeFromDom(root)
  }, [value])

  const {
    isComposing,
    isComposingRef,
    suppressNextBeforeInputRef,
    suppressNextKeydownCommitRef,
    compositionCommitKeyRef,
    compositionJustEndedAtRef,
    contentKey,
    onCompositionStart,
    onCompositionUpdate,
    onCompositionEnd
  } = useComposition(
    editorRef,
    serializeRawFromDom,
    handleSelectionChange,
    setValue,
    () => value
  )

  usePlaceholderSync(editorRef, placeholderRef, [value, placeholder])

  // weaving moved
  const getSelectionRange = useCallback(() => {
    const domSelection = window.getSelection()
    if (domSelection && domSelection.rangeCount > 0) {
      return domSelection.getRangeAt(0)
    }
    return null
  }, [])
  const { onBeforeInput, onKeyDown } = useKeyHandlers({
    editorRef,
    contentKey,
    multiline,
    onKeyDownProp,
    beginEditSession,
    endEditSession,
    pushUndoSnapshot,
    undo,
    redo,
    isComposingRef,
    compositionCommitKeyRef,
    suppressNextBeforeInputRef,
    suppressNextKeydownCommitRef,
    compositionJustEndedAtRef,
    setValue,
    valueRef,
    getActiveToken: () =>
      activeTokenRef.current
        ? {
            start: activeTokenRef.current.start,
            end: activeTokenRef.current.end
          }
        : null
  })
  const { onSelect } = useSelectionSnap({
    editorRef,
    setSelection,
    lastAnchorRectRef,
    suppressNextSelectionAdjustRef,
    lastArrowDirectionRef,
    lastShiftRef,
    isComposingRef
  })
  const { onCopy, onCut, onPaste } = useClipboard({
    editorRef,
    getValue: () => value,
    setValue,
    pushUndoSnapshot,
    isComposingRef
  })
  useVirtualKeyboard({
    editorRef,
    onVirtualKeyboardChange
  })
  const { onTouchStart, onTouchMove, onTouchEnd } = useTouchSelection({
    editorRef,
    handleSelectionChange,
    isComposingRef
  })
  // Wrap onKeyDown to route through portal keyboard handler first
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // If portal has a keyboard handler registered and it handles the event, stop
      if (
        isPopoverOpen &&
        portalKeyboardHandlerRef.current &&
        portalKeyboardHandlerRef.current(event)
      ) {
        return
      }
      // Otherwise, use the default key handler
      onKeyDown(event)
    },
    [isPopoverOpen, onKeyDown]
  )
  useImperativeHandle(forwardedRef, () => ({
    root: editorRef.current,
    setSelection: (start: number, end?: number) => {
      if (editorRef.current) {
        setSelectionImperative(start, end)
      }
    }
  }))
  return (
    <PopoverControlContext.Provider value={popoverControl}>
      <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Anchor virtualRef={chosenAnchorRef} />
        <InternalInlayProvider scope={__scope} registerToken={registerToken}>
          <PublicInlayProvider
            scope={__scope}
            value={value}
            selection={selection}
            activeToken={activeToken}
            activeTokenState={activeTokenState}
            getSelectionRange={getSelectionRange}
          >
            {/* First pass: renders children to populate registry */}
            <div style={{ display: 'none' }}>
              {React.Children.map(children, (child) =>
                annotateWithAncestor(child, null)
              )}
            </div>

            {/* Second pass: renders weaved content */}
            <div style={{ position: 'relative' }}>
              <div
                aria-label="Text input"
                {...inlayProps}
                ref={editorRef}
                // required to clear browser-inserted IME text
                key={contentKey}
                contentEditable
                role="textbox"
                aria-multiline={multiline}
                // Mobile input attributes
                inputMode={inputMode}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                enterKeyHint={enterKeyHint ?? (multiline ? 'enter' : 'done')}
                spellCheck={false}
                onSelect={onSelect}
                onBeforeInput={onBeforeInput}
                onKeyDown={handleKeyDown}
                onCompositionStart={onCompositionStart}
                onCompositionUpdate={onCompositionUpdate}
                onCompositionEnd={onCompositionEnd}
                onCopy={onCopy}
                onCut={onCut}
                onPaste={onPaste}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                suppressContentEditableWarning
                style={{
                  whiteSpace: 'pre-wrap',
                  // Prevent double-tap zoom on mobile
                  touchAction: 'manipulation',
                  ...inlayProps.style
                }}
              >
                {isRegistered ? weavedChildren : children}
              </div>
              {value.length === 0 && placeholder && !isComposing && (
                <div
                  ref={placeholderRef}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    pointerEvents: 'none',
                    color: '#AAA'
                  }}
                >
                  {placeholder}
                </div>
              )}
            </div>
            <PortalKeyboardContext.Provider value={portalKeyboardContext}>
              {popoverPortal}
            </PortalKeyboardContext.Provider>
          </PublicInlayProvider>
        </InternalInlayProvider>
      </Popover.Root>
    </PopoverControlContext.Provider>
  )
})

type PortalRenderProps = (context: PublicInlayContextValue) => React.ReactNode

type PortalProps = ScopedProps<
  Omit<Popover.PopoverContentProps, 'children'> & {
    children: PortalRenderProps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: `data-${string}`]: any
  }
>

const Portal = (props: PortalProps) => {
  const { __scope, children, ...contentProps } = props
  const context = usePublicInlayContext(COMPONENT_NAME, __scope)
  const popoverControl = useContext(PopoverControlContext)
  const keyboardContext = useContext(PortalKeyboardContext)

  const content = children(context)

  useLayoutEffect(() => {
    popoverControl?.setOpen(!!content)
  }, [content, popoverControl])

  if (!content) return null

  return (
    <Popover.Content
      onOpenAutoFocus={(e) => e.preventDefault()}
      side="bottom"
      align="center"
      {...contentProps}
    >
      <PortalKeyboardContext.Provider value={keyboardContext}>
        {content}
      </PortalKeyboardContext.Provider>
    </Popover.Content>
  )
}
Portal.displayName = 'Inlay.Portal'

// Attach List and Item to Portal for compound component API
const PortalWithList = Object.assign(Portal, {
  List: PortalList,
  Item: PortalItem
})

type TokenProps = ScopedProps<{
  value: string
  children: React.ReactNode
}> &
  React.HTMLAttributes<HTMLSpanElement>

const Token = React.forwardRef<HTMLSpanElement, TokenProps>((props, ref) => {
  const { __scope, value, children, ...textProps } = props
  const internalContext = useInternalInlayContext(TEXT_COMPONENT_NAME, __scope)
  const ancestor = useContext(AncestorContext)

  const nodeToRegister = (
    <span ref={ref} data-token-text={value} {...textProps}>
      {children}
    </span>
  )

  // Register the token with its text value and the React node itself.
  // If an ancestor is found in context, register that instead of the immediate span.
  internalContext.registerToken({
    text: value,
    node: ancestor || nodeToRegister
  })

  return nodeToRegister
})

Token.displayName = TEXT_COMPONENT_NAME

export { Inlay as Root, Token, PortalWithList as Portal }
