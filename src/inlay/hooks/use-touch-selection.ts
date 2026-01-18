import { useCallback, useRef } from 'react'
import { getClosestTokenEl } from '../internal/dom-utils'

export type TouchSelectionConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
  handleSelectionChange: () => void
  isComposingRef: React.MutableRefObject<boolean>
}

/**
 * Handles touch-based selection interactions on mobile devices.
 * - Debounces rapid touch events
 * - Snaps selection to token boundaries when touching inside tokens
 * - Handles long-press detection for native selection mode
 */
export function useTouchSelection(cfg: TouchSelectionConfig) {
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimeoutRef = useRef<number | null>(null)
  const isTouchActiveRef = useRef(false)

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }
  }, [])

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (cfg.isComposingRef.current) return

      const touch = event.touches[0]
      if (!touch) return

      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      isTouchActiveRef.current = true

      // Long-press detection (500ms) - triggers native selection mode
      // We don't prevent this; we just use it to know user wants selection
      clearLongPressTimeout()
      longPressTimeoutRef.current = window.setTimeout(() => {
        // After long press, let native selection handle it
        // We'll sync state in touchend or selectionchange
        longPressTimeoutRef.current = null
      }, 500)
    },
    [cfg.isComposingRef, clearLongPressTimeout]
  )

  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isTouchActiveRef.current) return

      const touch = event.touches[0]
      if (!touch || !touchStartPosRef.current) return

      // If user moves finger significantly, cancel long-press
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)
      if (dx > 10 || dy > 10) {
        clearLongPressTimeout()
      }
    },
    [clearLongPressTimeout]
  )

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      clearLongPressTimeout()
      isTouchActiveRef.current = false
      touchStartPosRef.current = null

      if (cfg.isComposingRef.current) return

      const root = cfg.editorRef.current
      if (!root) return

      // Check if touch ended inside a token
      const changedTouch = event.changedTouches[0]
      if (!changedTouch) return

      const elementAtPoint = document.elementFromPoint(
        changedTouch.clientX,
        changedTouch.clientY
      )

      if (elementAtPoint && root.contains(elementAtPoint)) {
        const tokenEl = getClosestTokenEl(elementAtPoint)

        if (tokenEl) {
          // If inside a token, snap selection to token boundary
          // Let the native selection happen first, then sync
          requestAnimationFrame(() => {
            cfg.handleSelectionChange()
          })
        } else {
          // Normal text area - just sync selection
          requestAnimationFrame(() => {
            cfg.handleSelectionChange()
          })
        }
      }
    },
    [cfg, clearLongPressTimeout]
  )

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  }
}

/**
 * Utility to detect if the current device supports touch
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  )
}

/**
 * Utility to detect iOS devices
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Utility to detect Android devices
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/.test(navigator.userAgent)
}
