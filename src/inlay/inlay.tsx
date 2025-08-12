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
import { getAbsoluteOffset, setDomSelection } from './internal/dom-utils'
import Graphemer from 'graphemer'

export const COMPONENT_NAME = 'Inlay'
export const TEXT_COMPONENT_NAME = 'Inlay.Text'

export type ScopedProps<P> = P & { __scope?: Scope }
const [createInlayContext, createInlayScope] =
  createContextScope(COMPONENT_NAME)

const AncestorContext = createContext<React.ReactElement | null>(null)
const PopoverControlContext = createContext<{
  setOpen: (open: boolean) => void
} | null>(null)

function annotateWithAncestor(
  node: React.ReactNode,
  currentAncestor: React.ReactElement | null
): React.ReactNode {
  if (!React.isValidElement(node)) {
    return node
  }

  const element = node as React.ReactElement<any>
  const nextAncestor = currentAncestor ?? element

  const children = element.props.children
  const wrappedChildren = React.Children.map(children, (child) =>
    annotateWithAncestor(child, nextAncestor)
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
  } & Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'onKeyDown'
  > & {
      onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => boolean // Return true to stop propagation
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
  const lastAnchorRectRef = useRef<DOMRect>(new DOMRect(0, 0, 0, 0))
  const virtualAnchorRef = useRef({
    getBoundingClientRect: () => lastAnchorRectRef.current
  })
  const popoverControl = useMemo(() => ({ setOpen: setIsPopoverOpen }), [])
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue || '',
    onChange
  })
  const editorRef = useRef<HTMLDivElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [isRegistered, setIsRegistered] = useState(false)
  const activeTokenRef = useRef<TokenInfo | null>(null)
  // Track last arrow direction and modifiers for snapping logic
  const lastArrowDirectionRef = useRef<'left' | 'right' | 'up' | 'down' | null>(
    null
  )
  const lastShiftRef = useRef(false)
  const suppressNextSelectionAdjustRef = useRef(false)
  // IME composition tracking
  const [isComposing, setIsComposing] = useState(false)
  const isComposingRef = useRef(false)
  const compositionStartSelectionRef = useRef<{
    start: number
    end: number
  } | null>(null)
  const compositionInitialValueRef = useRef<string | null>(null)
  const suppressNextBeforeInputRef = useRef(false)
  const [contentKey, setContentKey] = useState(0)
  const compositionCommitKeyRef = useRef<'enter' | 'space' | null>(null)
  const suppressNextKeydownCommitRef = useRef<null | 'enter' | 'space'>(null)
  const isWebKitSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent
    const isSafari =
      /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Opera/i.test(ua)
    // Include Mobile Safari; exclude Android Chrome
    return (
      isSafari ||
      (/AppleWebKit/i.test(ua) &&
        /Mobile/i.test(ua) &&
        !/Android/i.test(ua) &&
        !/CriOS/i.test(ua))
    )
  }, [])
  const compositionJustEndedAtRef = useRef<number>(0)
  const grapheme = useMemo(() => new Graphemer(), [])

  // --- Lightweight undo/redo stacks for manual edits ---
  type Snapshot = { value: string; selection: { start: number; end: number } }
  const undoStackRef = useRef<Snapshot[]>([])
  const redoStackRef = useRef<Snapshot[]>([])
  const MAX_HISTORY = 200

  const getCurrentSnapshot = useCallback((): Snapshot => {
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

  const pushUndoSnapshot = useCallback(() => {
    const snap = getCurrentSnapshot()
    const stack = undoStackRef.current
    if (stack.length >= MAX_HISTORY) stack.shift()
    stack.push(snap)
    // New edits invalidate redo history
    redoStackRef.current = []
  }, [getCurrentSnapshot])

  const applySnapshot = useCallback(
    (snap: Snapshot) => {
      // Apply value
      setValue(() => snap.value)
      // Restore selection on next frame after DOM updates
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

  // Coalesced undo session management
  const editSessionRef = useRef<{
    type: 'insert' | 'delete' | null
    timer: number | null
  }>({
    type: null,
    timer: null
  })
  const endEditSession = useCallback(() => {
    const s = editSessionRef.current
    if (s.timer != null) {
      clearTimeout(s.timer)
    }
    editSessionRef.current = { type: null, timer: null }
  }, [])
  const beginEditSession = useCallback(
    (type: 'insert' | 'delete') => {
      const s = editSessionRef.current
      if (s.type !== type) {
        // Different kind resets session
        endEditSession()
      }
      if (editSessionRef.current.type === null) {
        // Start of a new coalesced chunk: push snapshot
        pushUndoSnapshot()
      }
      // Refresh session
      const timer = window.setTimeout(() => {
        endEditSession()
      }, 800)
      editSessionRef.current = { type, timer }
    },
    [endEditSession, pushUndoSnapshot]
  )

  // Serialize editor DOM back to raw text, replacing diverged token subtrees with raw text
  const serializeRawFromDom = useCallback((): string => {
    const root = editorRef.current
    if (!root) return value
    const clone = root.cloneNode(true) as HTMLElement

    const getRenderedLen = (el: Element): number => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
      let total = 0
      let n: Node | null
      while ((n = walker.nextNode())) total += (n.textContent || '').length
      return total
    }

    const tokenEls = clone.querySelectorAll('[data-token-text]')
    tokenEls.forEach((el) => {
      const raw = el.getAttribute('data-token-text') || ''
      const renderedLen = getRenderedLen(el)
      if (renderedLen !== raw.length) {
        ;(el as HTMLElement).textContent = raw
      }
    })

    const text = (clone as HTMLElement).innerText
    return text
  }, [value])
  useLayoutEffect(() => {
    setIsRegistered(false)
  }, [children])
  const tokenRegistry = useRef<{ text: string; node: React.ReactElement }[]>([])
  if (!isRegistered) {
    tokenRegistry.current = []
  }
  const registerToken = useCallback(
    (token: { text: string; node: React.ReactElement }) => {
      tokenRegistry.current.push(token)
    },
    []
  )
  useLayoutEffect(() => {
    if (!isRegistered) {
      setIsRegistered(true)
    }
  }, [isRegistered])

  useLayoutEffect(() => {
    if (editorRef.current && placeholderRef.current) {
      const editorStyles = window.getComputedStyle(editorRef.current)
      const stylesToCopy: (keyof CSSStyleDeclaration)[] = [
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'fontFamily',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'textAlign'
      ]

      stylesToCopy.forEach((styleName) => {
        const value = editorStyles[styleName]
        if (value !== null) {
          placeholderRef.current!.style[styleName as any] = value as string
        }
      })

      // Ensure border styles are also copied to account for border width
      placeholderRef.current!.style.borderStyle = editorStyles.borderStyle
      placeholderRef.current!.style.borderColor = 'transparent'
    }
  }, [value, placeholder])

  const { weavedChildren, activeToken, activeTokenState } = useMemo(() => {
    if (!isRegistered) {
      return {
        weavedChildren: null,
        activeToken: activeTokenRef.current,
        activeTokenState: null
      }
    }
    const isStale = tokenRegistry.current.some(
      (token) => value.indexOf(token.text) === -1
    )
    if (isStale) {
      return {
        weavedChildren: null,
        activeToken: activeTokenRef.current,
        activeTokenState: null
      }
    }

    // This is the new, robust sorting algorithm to handle duplicate tokens.
    const sortedTokens: { text: string; node: React.ReactElement }[] = []
    const tokenPool = [...tokenRegistry.current]
    let searchIndex = 0
    while (searchIndex < value.length && tokenPool.length > 0) {
      let foundToken = false
      for (let i = 0; i < tokenPool.length; i++) {
        const token = tokenPool[i]
        if (value.startsWith(token.text, searchIndex)) {
          sortedTokens.push(token)
          tokenPool.splice(i, 1) // Consume the token from the pool
          searchIndex += token.text.length
          foundToken = true
          break // Restart the search from the new index
        }
      }
      if (!foundToken) {
        searchIndex++ // This position is a spacer, move on
      }
    }

    const result: React.ReactNode[] = []
    const map: TokenInfo[] = []
    let currentIndex = 0
    if (sortedTokens.length === 0) {
      const nodes: React.ReactNode[] = [<span key="full-text">{value}</span>]
      // Ensure a trailing <br> is rendered when the raw value ends with a newline
      if (multiline && value.endsWith('\n')) {
        nodes.push(<br key="trailing-br" />)
      }
      const tokenMap = [
        { text: value, node: <span />, start: 0, end: value.length }
      ]
      const active =
        tokenMap.find(
          (t) => selection.start >= t.start && selection.end <= t.end
        ) || null
      return {
        weavedChildren: nodes,
        activeToken: active,
        activeTokenState: null
      }
    }
    for (const token of sortedTokens) {
      const tokenStartIndex = value.indexOf(token.text, currentIndex)
      if (tokenStartIndex === -1) {
        continue
      }
      if (tokenStartIndex > currentIndex) {
        const spacerText = value.slice(currentIndex, tokenStartIndex)
        result.push(<span key={`spacer-${currentIndex}`}>{spacerText}</span>)
        map.push({
          text: spacerText,
          node: <span />,
          start: currentIndex,
          end: tokenStartIndex
        })
      }
      const tokenWithKey = React.cloneElement(token.node, {
        key: `token-${currentIndex}`
      })
      result.push(tokenWithKey)
      map.push({
        text: token.text,
        node: token.node,
        start: tokenStartIndex,
        end: tokenStartIndex + token.text.length
      })
      currentIndex = tokenStartIndex + token.text.length
    }
    if (currentIndex < value.length) {
      const trailingSpacer = value.slice(currentIndex)
      result.push(<span key="spacer-trailing">{trailingSpacer}</span>)
      map.push({
        text: trailingSpacer,
        node: <span />,
        start: currentIndex,
        end: value.length
      })
    }

    // If the value ends with a newline, add a <br> to force the browser to render it
    if (multiline && value.endsWith('\n')) {
      result.push(<br key="trailing-br" />)
    }

    const active =
      map.find((t) => selection.start >= t.start && selection.end <= t.end) ||
      null

    let activeTokenState: TokenState | null = null
    if (active) {
      const isCollapsed = selection.start === selection.end
      activeTokenState = {
        isCollapsed,
        isAtStartOfToken: isCollapsed && selection.start === active.start,
        isAtEndOfToken: isCollapsed && selection.end === active.end
      }
    }

    activeTokenRef.current = active

    // This logic is now handled correctly in dom-utils.ts
    return { weavedChildren: result, activeToken: active, activeTokenState }
  }, [value, isRegistered, selection, multiline])
  const getSelectionRange = useCallback(() => {
    const domSelection = window.getSelection()
    if (domSelection && domSelection.rangeCount > 0) {
      return domSelection.getRangeAt(0)
    }
    return null
  }, [])
  useImperativeHandle(forwardedRef, () => ({
    root: editorRef.current,
    setSelection: (start: number, end?: number) => {
      if (editorRef.current) {
        // Snap to grapheme boundaries for plain text; leave raw indices when spanning tokens
        const s = value
        const snapStart = (text: string, i: number): number => {
          if (i <= 0) return 0
          let pos = 0
          for (const cluster of grapheme.iterateGraphemes(text)) {
            const next = pos + cluster.length
            if (i < next) return pos
            pos = next
          }
          return pos
        }
        const snapEnd = (text: string, i: number): number => {
          if (i >= text.length) return text.length
          let pos = 0
          for (const cluster of grapheme.iterateGraphemes(text)) {
            const next = pos + cluster.length
            if (i <= pos) return pos
            if (i <= next) return next
            pos = next
          }
          return pos
        }
        const rawStart = Math.max(0, Math.min(start, s.length))
        const rawEnd =
          end != null ? Math.max(0, Math.min(end, s.length)) : rawStart
        const a = Math.min(rawStart, rawEnd)
        const b = Math.max(rawStart, rawEnd)
        const snappedStart = snapStart(s, a)
        const snappedEnd = end != null ? snapEnd(s, b) : snappedStart
        suppressNextSelectionAdjustRef.current = true
        setDomSelection(editorRef.current, snappedStart, snappedEnd)
        // Re-sync React's selection state with the new DOM selection
        handleSelectionChange()
      }
    }
  }))
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return

    // Avoid feedback loop after we programmatically set selection
    if (suppressNextSelectionAdjustRef.current) {
      suppressNextSelectionAdjustRef.current = false
      // Still sync selection state below for consistency
    }

    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return

    const range = domSelection.getRangeAt(0)

    // Compute candidate rect; prefer first client rect if available
    const clientRect =
      range.getClientRects()[0] || range.getBoundingClientRect()
    // Only update the last anchor rect if the rect looks valid (not at 0,0)
    if (!(clientRect.x === 0 && clientRect.y === 0)) {
      lastAnchorRectRef.current = new DOMRect(
        clientRect.x,
        clientRect.y,
        clientRect.width,
        clientRect.height
      )
    }

    if (!editorRef.current.contains(range.startContainer)) {
      // Keep previous anchor rect to avoid popover jumping to (0,0)
      return
    }

    const start = getAbsoluteOffset(
      editorRef.current,
      range.startContainer,
      range.startOffset
    )
    const end = getAbsoluteOffset(
      editorRef.current,
      range.endContainer,
      range.endOffset
    )
    setSelection({ start, end })

    // During IME composition, avoid any snapping to token edges to not disrupt the IME caret
    if (isComposingRef.current) {
      lastArrowDirectionRef.current = null
      lastShiftRef.current = false
      return
    }

    // Deferred snapping: if arrow moved into a DIVERGED token, snap caret/focus to token edge
    const direction = lastArrowDirectionRef.current
    const isShift = lastShiftRef.current
    if (direction) {
      requestAnimationFrame(() => {
        const root = editorRef.current
        if (!root) return
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const rng = sel.getRangeAt(0)

        const getClosestTokenEl = (n: Node | null): HTMLElement | null => {
          let curr: Node | null = n
          while (curr) {
            if (curr.nodeType === Node.ELEMENT_NODE) {
              const asEl = curr as HTMLElement
              if (asEl.hasAttribute('data-token-text')) return asEl
            }
            curr = (curr as any).parentNode || null
          }
          return null
        }

        const renderedLen = (el: Element): number => {
          const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_TEXT,
            null
          )
          let total = 0
          let n: Node | null
          while ((n = walker.nextNode())) total += (n.textContent || '').length
          return total
        }
        const rawLen = (el: Element): number =>
          (el.getAttribute('data-token-text') || '').length

        const findFirstTextNode = (el: Element): ChildNode | null => {
          const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_TEXT,
            null
          )
          return walker.nextNode() as ChildNode | null
        }
        const findLastTextNode = (el: Element): ChildNode | null => {
          const walker = document.createTreeWalker(
            el,
            NodeFilter.SHOW_TEXT,
            null
          )
          let last: Node | null = null
          let n: Node | null
          while ((n = walker.nextNode())) last = n
          return last as ChildNode | null
        }

        const snapEdgeForToken = (
          tokenEl: Element,
          prefer: 'start' | 'end'
        ): number | null => {
          if (!root) return null
          if (prefer === 'start') {
            const first = findFirstTextNode(tokenEl)
            if (first) return getAbsoluteOffset(root, first, 0)
            return null
          } else {
            const last = findLastTextNode(tokenEl)
            if (last) {
              const len = (last.textContent || '').length
              return getAbsoluteOffset(root, last, len)
            }
            return null
          }
        }

        const arrowToEdge = (dir: typeof direction): 'start' | 'end' =>
          dir === 'left' || dir === 'up' ? 'start' : 'end'

        const tokenEl = getClosestTokenEl(rng.startContainer)
        if (!tokenEl) {
          lastArrowDirectionRef.current = null
          lastShiftRef.current = false
          return
        }

        // Only snap for diverged tokens
        const isDiverged = renderedLen(tokenEl) !== rawLen(tokenEl)
        if (!isDiverged) {
          lastArrowDirectionRef.current = null
          lastShiftRef.current = false
          return
        }

        if (!isShift) {
          // Collapsed caret snap
          if (!rng.collapsed) return
          const edge = arrowToEdge(direction)
          const target = snapEdgeForToken(tokenEl, edge)
          if (target == null) return
          suppressNextSelectionAdjustRef.current = true
          setDomSelection(root, target)
        } else {
          // Shift+Arrow: adjust focus only, preserve anchor
          const anchorNode = sel.anchorNode
          const anchorOffset = sel.anchorOffset
          const edge = arrowToEdge(direction)
          const focusRaw = snapEdgeForToken(tokenEl, edge)
          if (focusRaw == null || !anchorNode) return
          const anchorRaw = getAbsoluteOffset(root, anchorNode, anchorOffset)
          const startRaw = Math.min(anchorRaw, focusRaw)
          const endRaw = Math.max(anchorRaw, focusRaw)
          suppressNextSelectionAdjustRef.current = true
          setDomSelection(root, startRaw, endRaw)
        }

        lastArrowDirectionRef.current = null
        lastShiftRef.current = false
      })
    }
  }, [])

  const onCompositionStart = useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      if (!editorRef.current) return
      isComposingRef.current = true
      setIsComposing(true)

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0)
        const start = getAbsoluteOffset(
          editorRef.current,
          r.startContainer,
          r.startOffset
        )
        const end = getAbsoluteOffset(
          editorRef.current,
          r.endContainer,
          r.endOffset
        )
        compositionStartSelectionRef.current = { start, end }
      } else {
        compositionStartSelectionRef.current = selection
      }

      // Treat composition as a coalesced insert session
      beginEditSession('insert')
      // Snapshot value at composition start to compute final commit without relying on DOM
      compositionInitialValueRef.current = value
    },
    [beginEditSession, selection, value]
  )

  const onCompositionUpdate = useCallback(
    (_event: React.CompositionEvent<HTMLDivElement>) => {
      // Let the IME render its marked text; we will reconcile on compositionend
    },
    []
  )

  const onCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      const root = editorRef.current
      if (!root) {
        isComposingRef.current = false
        setIsComposing(false)
        endEditSession()
        return
      }

      // Swallow trailing beforeinput (e.g., insertFromComposition) that some browsers fire
      suppressNextBeforeInputRef.current = true

      // Compute committed text and new model strictly from the snapshot at compositionstart
      let committed = event.data || ''
      const baseValue = compositionInitialValueRef.current ?? value
      const range = compositionStartSelectionRef.current ?? selection
      const len = baseValue.length
      const safeStart = Math.max(0, Math.min(range.start, len))
      const safeEnd = Math.max(0, Math.min(range.end, len))
      const before = baseValue.slice(0, safeStart)
      const after = baseValue.slice(safeEnd)

      // Safari sometimes provides empty event.data on compositionend. Fallback: diff DOM vs snapshot.
      if (!committed) {
        const domText = serializeRawFromDom()
        const replacedLen = safeEnd - safeStart
        const insertedLen = Math.max(
          0,
          domText.length - (baseValue.length - replacedLen)
        )
        if (insertedLen > 0 && safeStart + insertedLen <= domText.length) {
          committed = domText.slice(safeStart, safeStart + insertedLen)
        }
      }

      // On Safari Enter commit, strip trailing newlines from committed text if any leaked in
      if (isWebKitSafari && compositionCommitKeyRef.current === 'enter') {
        committed = committed.replace(/\n+$/, '')
      }

      const newValue = before + committed + after
      const caretAfter = safeStart + committed.length

      // Apply value and force a remount to clear any stray composition DOM artifacts
      setValue(() => newValue)
      setContentKey((k) => k + 1)

      requestAnimationFrame(() => {
        const r = editorRef.current
        if (!r) return
        suppressNextSelectionAdjustRef.current = true
        setDomSelection(r, caretAfter)
        // Sync selection state
        handleSelectionChange()
      })

      // On WebKit, keydown for the commit (Enter/Space) may fire AFTER compositionend.
      // Suppress that immediate keydown once to avoid inserting stray newlines.
      if (isWebKitSafari) {
        // Default to suppressing Enter; Space is rare but safe to guard.
        suppressNextKeydownCommitRef.current = 'enter'
        compositionJustEndedAtRef.current = Date.now()
      }

      endEditSession()
      isComposingRef.current = false
      setIsComposing(false)
      compositionCommitKeyRef.current = null
      compositionInitialValueRef.current = null
    },
    [
      endEditSession,
      handleSelectionChange,
      setValue,
      selection,
      isWebKitSafari,
      value
    ]
  )

  const onBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    if (!editorRef.current) return

    const nativeAny = event.nativeEvent as any
    const data: string | null | undefined = nativeAny.data
    const inputType: string | undefined = nativeAny.inputType

    // Swallow the trailing beforeinput after composition commits
    if (suppressNextBeforeInputRef.current) {
      suppressNextBeforeInputRef.current = false
      event.preventDefault()
      return
    }

    // Safari: In a brief window right after compositionend, block newline insertions
    if (
      isWebKitSafari &&
      compositionJustEndedAtRef.current &&
      Date.now() - compositionJustEndedAtRef.current < 50 &&
      (inputType === 'insertParagraph' || inputType === 'insertLineBreak')
    ) {
      event.preventDefault()
      return
    }

    // During composition, let IME manage text; block line breaks to avoid stray <br>
    if (isComposingRef.current) {
      if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
        event.preventDefault()
      }
      return
    }

    // Handle mobile virtual keyboard deletions via beforeinput
    if (
      inputType === 'deleteContentBackward' ||
      inputType === 'deleteContentForward'
    ) {
      event.preventDefault()
      const domSelection = window.getSelection()
      if (!domSelection || !domSelection.rangeCount) return
      const range = domSelection.getRangeAt(0)
      const start = getAbsoluteOffset(
        editorRef.current,
        range.startContainer,
        range.startOffset
      )
      const end = getAbsoluteOffset(
        editorRef.current,
        range.endContainer,
        range.endOffset
      )

      const getPrevGraphemeStart = (s: string, index: number): number => {
        if (index <= 0) return 0
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (next >= index) return pos
          pos = next
        }
        return pos
      }
      const getNextGraphemeEnd = (s: string, index: number): number => {
        if (index >= s.length) return s.length
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index < next) return next
          pos = next
        }
        return s.length
      }
      const getGraphemeStartAt = (s: string, index: number): number => {
        if (index <= 0) return 0
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index < next) return pos
          pos = next
        }
        return pos
      }
      const getGraphemeEndAt = (s: string, index: number): number => {
        if (index >= s.length) return s.length
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index <= pos) return pos
          if (index <= next) return next
          pos = next
        }
        return pos
      }
      const selectionIntersectsToken = (): boolean => {
        const root = editorRef.current
        const sel = window.getSelection()
        if (!root || !sel || sel.rangeCount === 0) return false
        const rng = sel.getRangeAt(0)
        const tokens = root.querySelectorAll('[data-token-text]')
        for (let i = 0; i < tokens.length; i++) {
          const el = tokens[i]
          if (typeof (rng as any).intersectsNode === 'function') {
            if ((rng as any).intersectsNode(el)) return true
          } else {
            const tr = document.createRange()
            tr.selectNode(el)
            const overlap =
              rng.compareBoundaryPoints(Range.END_TO_START, tr) === 1 &&
              rng.compareBoundaryPoints(Range.START_TO_END, tr) === -1
            if (overlap) return true
          }
        }
        return false
      }

      setValue((currentValue) => {
        const len = currentValue.length
        const safeStart = Math.max(0, Math.min(start, len))
        const safeEnd = Math.max(0, Math.min(end, len))
        let newSelection = safeStart
        let before = ''
        let after = ''
        if (safeStart === safeEnd) {
          if (inputType === 'deleteContentBackward') {
            if (safeStart === 0) return currentValue
            const active = activeTokenRef.current
            const isInsideToken = !!(
              active &&
              safeStart > active.start &&
              safeStart <= active.end
            )
            if (isInsideToken) {
              const delStart = safeStart - 1
              before = currentValue.slice(0, delStart)
              after = currentValue.slice(safeStart)
              newSelection = delStart
            } else {
              const clusterStart = getPrevGraphemeStart(currentValue, safeStart)
              before = currentValue.slice(0, clusterStart)
              after = currentValue.slice(safeStart)
              newSelection = clusterStart
            }
          } else {
            // deleteContentForward
            if (safeStart === len) return currentValue
            const active = activeTokenRef.current
            const isInsideToken = !!(
              active &&
              safeStart >= active.start &&
              safeStart < active.end
            )
            if (isInsideToken) {
              const delEnd = safeStart + 1
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(delEnd)
              newSelection = safeStart
            } else {
              const clusterEnd = getNextGraphemeEnd(currentValue, safeStart)
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(clusterEnd)
              newSelection = safeStart
            }
          }
        } else {
          if (selectionIntersectsToken()) {
            before = currentValue.slice(0, safeStart)
            after = currentValue.slice(safeEnd)
            newSelection = safeStart
          } else {
            const adjStart = getGraphemeStartAt(currentValue, safeStart)
            const adjEnd = getGraphemeEndAt(currentValue, safeEnd)
            before = currentValue.slice(0, adjStart)
            after = currentValue.slice(adjEnd)
            newSelection = adjStart
          }
        }
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return before + after
      })
      return
    }

    event.preventDefault()
    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return
    const range = domSelection.getRangeAt(0)
    let start = getAbsoluteOffset(
      editorRef.current,
      range.startContainer,
      range.startOffset
    )
    let end = getAbsoluteOffset(
      editorRef.current,
      range.endContainer,
      range.endOffset
    )

    if (!data) return

    // Begin/refresh coalesced insert session
    beginEditSession('insert')

    setValue((currentValue) => {
      const len = currentValue.length
      const safeStart = Math.max(0, Math.min(start, len))
      const safeEnd = Math.max(0, Math.min(end, len))
      const before = currentValue.slice(0, safeStart)
      const after = currentValue.slice(safeEnd)
      const newValue = before + data + after
      const newSelection = safeStart + data.length
      setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
      return newValue
    })
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow the consumer to intercept and handle the event first.
    if (onKeyDownProp?.(event)) {
      return
    }

    // WebKit special-casing: if a commit keydown (Enter/Space) arrives immediately after
    // compositionend (due to event order bug), ignore it once.
    if (isWebKitSafari && suppressNextKeydownCommitRef.current) {
      if (
        (suppressNextKeydownCommitRef.current === 'enter' &&
          (event.key === 'Enter' || event.key === 'Return')) ||
        (suppressNextKeydownCommitRef.current === 'space' && event.key === ' ')
      ) {
        event.preventDefault()
        event.stopPropagation()
        suppressNextKeydownCommitRef.current = null
        return
      }
      // Clear if a different key occurs next to avoid stale suppression
      suppressNextKeydownCommitRef.current = null
    }

    // If composing, let the IME control the keystrokes (including Enter/Space). We will reconcile on compositionend.
    if (isComposingRef.current) {
      if (event.key === 'Enter' || event.key === 'Return') {
        // Prevent the commit-enter from inserting line breaks into the DOM
        event.preventDefault()
        event.stopPropagation()
        compositionCommitKeyRef.current = 'enter'
        return
      }
      if (event.key === ' ') {
        // Prevent stray text nodes on space-commit
        event.preventDefault()
        event.stopPropagation()
        compositionCommitKeyRef.current = 'space'
        return
      }
      return
    }

    // Block newline insertion when multiline is false
    if (!multiline && event.key === 'Enter') {
      event.preventDefault()
      return
    }

    // End coalesced session on navigation/modifier keys
    if (
      event.key.startsWith('Arrow') ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      // Do not end on shift alone; only if it's pure navigation we end in selection handler
      if (!(event.key === 'Shift')) {
        endEditSession()
      }
    }

    // Undo/Redo shortcuts (only if we have custom snapshots; otherwise let native)
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const isUndo = event.key.toLowerCase() === 'z' && !event.shiftKey
      const isRedo =
        (event.key.toLowerCase() === 'z' && event.shiftKey) ||
        event.key.toLowerCase() === 'y'

      if (isUndo) {
        const stack = undoStackRef.current
        if (stack.length > 0) {
          event.preventDefault()
          const current = getCurrentSnapshot()
          const last = stack.pop()!
          const redoStack = redoStackRef.current
          if (redoStack.length >= MAX_HISTORY) redoStack.shift()
          redoStack.push(current)
          applySnapshot(last)
          return
        }
      } else if (isRedo) {
        const redoStack = redoStackRef.current
        if (redoStack.length > 0) {
          event.preventDefault()
          const current = getCurrentSnapshot()
          const next = redoStack.pop()!
          const undoStack = undoStackRef.current
          if (undoStack.length >= MAX_HISTORY) undoStack.shift()
          undoStack.push(current)
          applySnapshot(next)
          return
        }
      }
    }

    if (!editorRef.current) return
    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return

    const range = domSelection.getRangeAt(0)
    const start = getAbsoluteOffset(
      editorRef.current,
      range.startContainer,
      range.startOffset
    )

    if (event.key === 'Enter') {
      event.preventDefault()
      let end = getAbsoluteOffset(
        editorRef.current,
        range.endContainer,
        range.endOffset
      )

      // Enter as its own chunk
      pushUndoSnapshot()
      endEditSession()

      setValue((currentValue) => {
        const len = currentValue.length
        const safeStart = Math.max(0, Math.min(start, len))
        const safeEnd = Math.max(0, Math.min(end, len))
        const before = currentValue.slice(0, safeStart)
        const after = currentValue.slice(safeEnd)
        const newValue = before + '\n' + after
        const newSelection = safeStart + 1
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return newValue
      })
    }

    if (event.key === ' ') {
      event.preventDefault()
      let end = getAbsoluteOffset(
        editorRef.current,
        range.endContainer,
        range.endOffset
      )

      // Space is insert; coalesce
      beginEditSession('insert')

      setValue((currentValue) => {
        const len = currentValue.length
        const safeStart = Math.max(0, Math.min(start, len))
        const safeEnd = Math.max(0, Math.min(end, len))
        const before = currentValue.slice(0, safeStart)
        const after = currentValue.slice(safeEnd)
        const newValue = before + ' ' + after
        const newSelection = safeStart + 1
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return newValue
      })
    }
    if (event.key === 'Delete') {
      event.preventDefault()

      // Coalesce deletes
      beginEditSession('delete')

      // Grapheme helpers using Graphemer
      const getNextGraphemeEnd = (s: string, index: number): number => {
        if (index >= s.length) return s.length
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index < next) return next
          pos = next
        }
        return s.length
      }
      const getGraphemeStartAt = (s: string, index: number): number => {
        if (index <= 0) return 0
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index < next) return pos
          pos = next
        }
        return pos
      }
      const getGraphemeEndAt = (s: string, index: number): number => {
        if (index >= s.length) return s.length
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index <= pos) return pos
          if (index <= next) return next
          pos = next
        }
        return pos
      }
      const selectionIntersectsToken = (): boolean => {
        const root = editorRef.current
        const sel = window.getSelection()
        if (!root || !sel || sel.rangeCount === 0) return false
        const rng = sel.getRangeAt(0)
        const tokens = root.querySelectorAll('[data-token-text]')
        for (let i = 0; i < tokens.length; i++) {
          const el = tokens[i]
          if (typeof (rng as any).intersectsNode === 'function') {
            if ((rng as any).intersectsNode(el)) return true
          } else {
            const tr = document.createRange()
            tr.selectNode(el)
            const overlap =
              rng.compareBoundaryPoints(Range.END_TO_START, tr) === 1 &&
              rng.compareBoundaryPoints(Range.START_TO_END, tr) === -1
            if (overlap) return true
          }
        }
        return false
      }

      setValue((currentValue) => {
        if (!currentValue) return ''
        const len = currentValue.length
        const safeStart = Math.max(0, Math.min(start, len))
        const sel = window.getSelection()
        const isCollapsed =
          !!sel && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed

        let newSelection = safeStart
        let before: string
        let after: string
        if (isCollapsed) {
          if (safeStart === len) return currentValue
          // If caret is inside a token raw span, delete exactly one raw char after caret
          const active = activeTokenRef.current
          const isInsideToken = !!(
            active &&
            safeStart >= active.start &&
            safeStart < active.end
          )
          if (isInsideToken) {
            const delEnd = safeStart + 1
            before = currentValue.slice(0, safeStart)
            after = currentValue.slice(delEnd)
            newSelection = safeStart
          } else {
            const clusterEnd = getNextGraphemeEnd(currentValue, safeStart)
            before = currentValue.slice(0, safeStart)
            after = currentValue.slice(clusterEnd)
            newSelection = safeStart
          }
        } else {
          // Non-collapsed: grapheme-aware unless selection intersects a token
          const rng = sel!.getRangeAt(0)
          const rawEnd = getAbsoluteOffset(
            editorRef.current!,
            rng.endContainer,
            rng.endOffset
          )
          const safeEnd = Math.max(0, Math.min(rawEnd, len))
          if (selectionIntersectsToken()) {
            before = currentValue.slice(0, safeStart)
            after = currentValue.slice(safeEnd)
            newSelection = safeStart
          } else {
            const adjStart = getGraphemeStartAt(currentValue, safeStart)
            const adjEnd = getGraphemeEndAt(currentValue, safeEnd)
            before = currentValue.slice(0, adjStart)
            after = currentValue.slice(adjEnd)
            newSelection = adjStart
          }
        }
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return before + after
      })
    }
    if (event.key === 'Backspace') {
      event.preventDefault()

      // Coalesce backspaces
      beginEditSession('delete')

      // Grapheme cluster previous-boundary using Graphemer
      const getPrevGraphemeStart = (s: string, index: number): number => {
        if (index <= 0) return 0
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (next >= index) return pos
          pos = next
        }
        return pos
      }
      const getGraphemeStartAt = (s: string, index: number): number => {
        if (index <= 0) return 0
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index < next) return pos
          pos = next
        }
        return pos
      }
      const getGraphemeEndAt = (s: string, index: number): number => {
        if (index >= s.length) return s.length
        let pos = 0
        for (const cluster of grapheme.iterateGraphemes(s)) {
          const next = pos + cluster.length
          if (index <= pos) return pos
          if (index <= next) return next
          pos = next
        }
        return pos
      }
      const selectionIntersectsToken = (): boolean => {
        const root = editorRef.current
        const sel = window.getSelection()
        if (!root || !sel || sel.rangeCount === 0) return false
        const rng = sel.getRangeAt(0)
        const tokens = root.querySelectorAll('[data-token-text]')
        for (let i = 0; i < tokens.length; i++) {
          const el = tokens[i]
          if (typeof (rng as any).intersectsNode === 'function') {
            if ((rng as any).intersectsNode(el)) return true
          } else {
            const tr = document.createRange()
            tr.selectNode(el)
            const overlap =
              rng.compareBoundaryPoints(Range.END_TO_START, tr) === 1 &&
              rng.compareBoundaryPoints(Range.START_TO_END, tr) === -1
            if (overlap) return true
          }
        }
        return false
      }

      setValue((currentValue) => {
        if (!currentValue) return ''
        const len = currentValue.length
        let newSelection = start
        let before: string
        let after: string
        if (range.collapsed) {
          const safeStart = Math.max(0, Math.min(start, len))
          if (safeStart === 0) return currentValue
          // If caret is inside a token raw span, delete exactly one raw char before caret
          const active = activeTokenRef.current
          const isInsideToken = !!(
            active &&
            safeStart > active.start &&
            safeStart <= active.end
          )
          if (isInsideToken) {
            const delStart = safeStart - 1
            before = currentValue.slice(0, delStart)
            after = currentValue.slice(safeStart)
            newSelection = delStart
          } else {
            const clusterStart = getPrevGraphemeStart(currentValue, safeStart)
            before = currentValue.slice(0, clusterStart)
            after = currentValue.slice(safeStart)
            newSelection = clusterStart
          }
        } else {
          let end = getAbsoluteOffset(
            editorRef.current!,
            range.endContainer,
            range.endOffset
          )
          const safeStart = Math.max(0, Math.min(start, len))
          const safeEnd = Math.max(0, Math.min(end, len))
          if (selectionIntersectsToken()) {
            before = currentValue.slice(0, safeStart)
            after = currentValue.slice(safeEnd)
            newSelection = safeStart
          } else {
            const adjStart = getGraphemeStartAt(currentValue, safeStart)
            const adjEnd = getGraphemeEndAt(currentValue, safeEnd)
            before = currentValue.slice(0, adjStart)
            after = currentValue.slice(adjEnd)
            newSelection = adjStart
          }
        }
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return before + after
      })
    }
  }
  return (
    <PopoverControlContext.Provider value={popoverControl}>
      <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Anchor virtualRef={virtualAnchorRef} />
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
                {...inlayProps}
                ref={editorRef}
                key={contentKey}
                contentEditable
                role="textbox"
                aria-multiline={multiline}
                onSelect={handleSelectionChange}
                onBeforeInput={onBeforeInput}
                onKeyDown={onKeyDown}
                onCompositionStart={onCompositionStart}
                onCompositionUpdate={onCompositionUpdate}
                onCompositionEnd={onCompositionEnd}
                suppressContentEditableWarning
                style={{
                  whiteSpace: 'pre-wrap',
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
            {popoverPortal}
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
  }
>

const Portal = (props: PortalProps) => {
  const { __scope, children, ...contentProps } = props
  const context = usePublicInlayContext(COMPONENT_NAME, __scope)
  const popoverControl = useContext(PopoverControlContext)

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
      {content}
    </Popover.Content>
  )
}
Portal.displayName = 'Inlay.Portal'

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

export { Inlay as Root, Token, Portal }
