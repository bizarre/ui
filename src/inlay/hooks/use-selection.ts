import { useCallback, useEffect, useRef, useState } from 'react'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'
import { snapGraphemeEnd, snapGraphemeStart } from '../internal/string-utils'

export type SelectionState = { start: number; end: number }

// Detect iOS Safari - includes modern iPads that report as "MacIntel" with touch
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export function useSelection(
  editorRef: React.RefObject<HTMLDivElement | null>,
  value: string
) {
  const [selection, setSelection] = useState<SelectionState>({
    start: 0,
    end: 0
  })
  const lastAnchorRectRef = useRef<DOMRect>(new DOMRect(0, 0, 0, 0))
  const virtualAnchorRef = useRef({
    getBoundingClientRect: () => lastAnchorRectRef.current
  })
  const suppressNextSelectionAdjustRef = useRef(false)

  // Update just the anchor rect from current selection
  const updateAnchorRect = useCallback(() => {
    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return

    const range = domSelection.getRangeAt(0)
    const clientRect =
      range.getClientRects()[0] || range.getBoundingClientRect()
    if (!(clientRect.x === 0 && clientRect.y === 0)) {
      lastAnchorRectRef.current = new DOMRect(
        clientRect.x,
        clientRect.y,
        clientRect.width,
        clientRect.height
      )
    }
  }, [])

  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return

    // Avoid feedback loop after we programmatically set selection
    if (suppressNextSelectionAdjustRef.current) {
      suppressNextSelectionAdjustRef.current = false
    }

    const domSelection = window.getSelection()
    if (!domSelection || !domSelection.rangeCount) return

    const range = domSelection.getRangeAt(0)

    // Update anchor rect
    updateAnchorRect()

    if (!editorRef.current.contains(range.startContainer)) {
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
  }, [editorRef, updateAnchorRect])

  const setSelectionImperative = useCallback(
    (start: number, end?: number) => {
      const root = editorRef.current
      if (!root) return
      const s = value
      const rawStart = Math.max(0, Math.min(start, s.length))
      const rawEnd =
        end != null ? Math.max(0, Math.min(end, s.length)) : rawStart
      const a = Math.min(rawStart, rawEnd)
      const b = Math.max(rawStart, rawEnd)
      const snappedStart = snapGraphemeStart(s, a)
      const snappedEnd = end != null ? snapGraphemeEnd(s, b) : snappedStart
      suppressNextSelectionAdjustRef.current = true
      setDomSelection(root, snappedStart, snappedEnd)
      handleSelectionChange()
    },
    [editorRef, handleSelectionChange, value]
  )

  // iOS Safari fires selectionchange on document, not the element.
  // This listener ensures we capture selection changes on mobile Safari.
  useEffect(() => {
    const handleDocumentSelectionChange = () => {
      const root = editorRef.current
      if (!root) return

      // Only process if our editor is focused or contains the selection
      const domSelection = window.getSelection()
      if (!domSelection || !domSelection.rangeCount) return

      const range = domSelection.getRangeAt(0)
      if (!root.contains(range.startContainer)) return

      // Delegate to our existing handler
      handleSelectionChange()
    }

    document.addEventListener('selectionchange', handleDocumentSelectionChange)
    return () => {
      document.removeEventListener(
        'selectionchange',
        handleDocumentSelectionChange
      )
    }
  }, [editorRef, handleSelectionChange])

  // iOS: Update anchor rect after input/viewport changes (caret rect can be stale)
  useEffect(() => {
    if (!isIOS) return

    let rafId: number | null = null
    const deferredUpdate = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        updateAnchorRect()
      })
    }

    const handleInput = (e: Event) => {
      const root = editorRef.current
      if (root?.contains(e.target as Node)) deferredUpdate()
    }

    const handleViewportChange = () => {
      const root = editorRef.current
      if (
        root &&
        (document.activeElement === root ||
          root.contains(document.activeElement))
      ) {
        deferredUpdate()
      }
    }

    document.addEventListener('input', handleInput, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', handleViewportChange)
    vv?.addEventListener('scroll', handleViewportChange)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('input', handleInput, true)
      vv?.removeEventListener('resize', handleViewportChange)
      vv?.removeEventListener('scroll', handleViewportChange)
    }
  }, [editorRef, updateAnchorRect])

  return {
    selection,
    setSelection,
    setSelectionImperative,
    handleSelectionChange,
    lastAnchorRectRef,
    virtualAnchorRef,
    suppressNextSelectionAdjustRef
  }
}
