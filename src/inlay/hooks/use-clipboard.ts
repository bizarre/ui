import { useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import {
  getAbsoluteOffset,
  setDomSelection,
  getClosestTokenEl,
  getTokenRawRange
} from '../internal/dom-utils'

export type ClipboardConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
  getValue: () => string
  setValue: React.Dispatch<React.SetStateAction<string>>
  pushUndoSnapshot?: () => void
  isComposingRef: React.MutableRefObject<boolean>
}

function getSelectionFromDom(
  root: HTMLElement
): { start: number; end: number } | null {
  const domSelection = window.getSelection()
  if (!domSelection || !domSelection.rangeCount) return null

  const range = domSelection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null

  let start = getAbsoluteOffset(root, range.startContainer, range.startOffset)
  let end = getAbsoluteOffset(root, range.endContainer, range.endOffset)

  // Handle snapped offsets when DOM selection exists but offsets collapsed
  if (start === end && !range.collapsed) {
    const startToken = getClosestTokenEl(range.startContainer)
    const endToken = getClosestTokenEl(range.endContainer)

    if (startToken && startToken === endToken) {
      const tokenRange = getTokenRawRange(root, startToken)
      if (tokenRange) return tokenRange
    } else if (startToken) {
      const tokenRange = getTokenRawRange(root, startToken)
      if (tokenRange) {
        start = tokenRange.start
        end = tokenRange.end
      }
    } else if (endToken) {
      const tokenRange = getTokenRawRange(root, endToken)
      if (tokenRange) {
        start = tokenRange.start
        end = tokenRange.end
      }
    }
  }

  // Expand partial token selections to full token boundaries
  const startToken = getClosestTokenEl(range.startContainer)
  if (startToken) {
    const tokenRange = getTokenRawRange(root, startToken)
    if (tokenRange && start > tokenRange.start && start < tokenRange.end) {
      start = tokenRange.start
    }
  }

  const endToken = getClosestTokenEl(range.endContainer)
  if (endToken) {
    const tokenRange = getTokenRawRange(root, endToken)
    if (tokenRange && end > tokenRange.start && end < tokenRange.end) {
      end = tokenRange.end
    }
  }

  return { start, end }
}

export function useClipboard(cfg: ClipboardConfig) {
  // Track pending selection for rapid operations where DOM hasn't caught up yet
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null
  )
  const pendingClearTimeoutRef = useRef<number | null>(null)

  const onCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault()

      const root = cfg.editorRef.current
      if (!root) return

      const sel = getSelectionFromDom(root)
      if (!sel || sel.start === sel.end) return

      const rawText = cfg.getValue().slice(sel.start, sel.end)
      event.clipboardData.setData('text/plain', rawText)
    },
    [cfg]
  )

  const onCut = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault()

      const root = cfg.editorRef.current
      if (!root) return

      const sel = getSelectionFromDom(root)
      if (!sel || sel.start === sel.end) return

      const rawText = cfg.getValue().slice(sel.start, sel.end)
      event.clipboardData.setData('text/plain', rawText)

      cfg.pushUndoSnapshot?.()

      cfg.setValue((currentValue) => {
        const before = currentValue.slice(0, sel.start)
        const after = currentValue.slice(sel.end)

        requestAnimationFrame(() => {
          const root = cfg.editorRef.current
          if (root?.isConnected) setDomSelection(root, sel.start)
        })

        return before + after
      })
    },
    [cfg]
  )

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (cfg.isComposingRef.current) return
      event.preventDefault()

      const pastedText = event.clipboardData.getData('text/plain')
      if (!pastedText) return

      const root = cfg.editorRef.current
      if (!root) return

      // Use pending selection if available (from rapid paste), otherwise read from DOM
      const sel = pendingSelectionRef.current ?? getSelectionFromDom(root)
      if (!sel) return

      cfg.pushUndoSnapshot?.()

      const len = cfg.getValue().length
      const safeStart = Math.max(0, Math.min(sel.start, len))
      const newSelection = safeStart + pastedText.length

      // Update pending selection synchronously BEFORE state update
      // so subsequent rapid pastes use the correct position
      pendingSelectionRef.current = { start: newSelection, end: newSelection }

      // Use flushSync to ensure DOM is updated synchronously
      flushSync(() => {
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(sel.start, len))
          const safeEnd = Math.max(0, Math.min(sel.end, len))
          const before = currentValue.slice(0, safeStart)
          const after = currentValue.slice(safeEnd)
          return before + pastedText + after
        })
      })

      // Set selection immediately after flushSync (DOM is now updated)
      if (root.isConnected) {
        setDomSelection(root, newSelection)
      }

      // Clear pending selection after a short delay, giving time for
      // rapid paste events to complete before falling back to DOM
      if (pendingClearTimeoutRef.current !== null) {
        clearTimeout(pendingClearTimeoutRef.current)
      }
      pendingClearTimeoutRef.current = window.setTimeout(() => {
        pendingClearTimeoutRef.current = null
        pendingSelectionRef.current = null
      }, 100)
    },
    [cfg]
  )

  return { onCopy, onCut, onPaste }
}
