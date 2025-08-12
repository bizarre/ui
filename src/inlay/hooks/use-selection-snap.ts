import { useCallback } from 'react'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'

export type SelectionSnapConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
  setSelection: (sel: { start: number; end: number }) => void
  lastAnchorRectRef: React.MutableRefObject<DOMRect>
  suppressNextSelectionAdjustRef: React.MutableRefObject<boolean>
  lastArrowDirectionRef: React.MutableRefObject<
    'left' | 'right' | 'up' | 'down' | null
  >
  lastShiftRef: React.MutableRefObject<boolean>
  isComposingRef: React.MutableRefObject<boolean>
}

export function useSelectionSnap(cfg: SelectionSnapConfig) {
  const onSelect = useCallback(() => {
    const root = cfg.editorRef.current
    if (!root) return

    if (cfg.suppressNextSelectionAdjustRef.current) {
      cfg.suppressNextSelectionAdjustRef.current = false
    }

    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return

    const range = domSelection.getRangeAt(0)
    const clientRect =
      range.getClientRects()[0] || range.getBoundingClientRect()
    if (!(clientRect.x === 0 && clientRect.y === 0)) {
      cfg.lastAnchorRectRef.current = new DOMRect(
        clientRect.x,
        clientRect.y,
        clientRect.width,
        clientRect.height
      )
    }

    if (!root.contains(range.startContainer)) return

    const start = getAbsoluteOffset(
      root,
      range.startContainer,
      range.startOffset
    )
    const end = getAbsoluteOffset(root, range.endContainer, range.endOffset)
    cfg.setSelection({ start, end })

    if (cfg.isComposingRef.current) {
      cfg.lastArrowDirectionRef.current = null
      cfg.lastShiftRef.current = false
      return
    }

    const direction = cfg.lastArrowDirectionRef.current
    const isShift = cfg.lastShiftRef.current
    if (direction) {
      requestAnimationFrame(() => {
        const root = cfg.editorRef.current
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
          cfg.lastArrowDirectionRef.current = null
          cfg.lastShiftRef.current = false
          return
        }

        const isDiverged = renderedLen(tokenEl) !== rawLen(tokenEl)
        if (!isDiverged) {
          cfg.lastArrowDirectionRef.current = null
          cfg.lastShiftRef.current = false
          return
        }

        if (!isShift) {
          if (!rng.collapsed) return
          const edge = arrowToEdge(direction)
          const target = snapEdgeForToken(tokenEl, edge)
          if (target == null) return
          cfg.suppressNextSelectionAdjustRef.current = true
          setDomSelection(root, target)
        } else {
          const anchorNode = sel.anchorNode
          const anchorOffset = sel.anchorOffset
          const edge = arrowToEdge(direction)
          const focusRaw = snapEdgeForToken(tokenEl, edge)
          if (focusRaw == null || !anchorNode) return
          const anchorRaw = getAbsoluteOffset(root, anchorNode, anchorOffset)
          const startRaw = Math.min(anchorRaw, focusRaw)
          const endRaw = Math.max(anchorRaw, focusRaw)
          cfg.suppressNextSelectionAdjustRef.current = true
          setDomSelection(root, startRaw, endRaw)
        }

        cfg.lastArrowDirectionRef.current = null
        cfg.lastShiftRef.current = false
      })
    }
  }, [cfg])

  return { onSelect }
}
