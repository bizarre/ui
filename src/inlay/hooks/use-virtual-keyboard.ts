import { useEffect, useRef, useCallback } from 'react'

export type VirtualKeyboardConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
  onVirtualKeyboardChange?: (open: boolean) => void
}

/**
 * Detects virtual keyboard visibility changes using the visualViewport API.
 * Scrolls the editor into view when the keyboard opens.
 */
export function useVirtualKeyboard(cfg: VirtualKeyboardConfig) {
  const isKeyboardOpenRef = useRef(false)
  const initialViewportHeightRef = useRef<number | null>(null)

  const handleViewportResize = useCallback(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Store initial viewport height on first call
    if (initialViewportHeightRef.current === null) {
      initialViewportHeightRef.current = vv.height
    }

    // Detect keyboard by comparing current viewport height to initial
    // A significant reduction (>25%) typically indicates keyboard is open
    const threshold = initialViewportHeightRef.current * 0.75
    const keyboardOpen = vv.height < threshold

    // Only fire callback on state change
    if (keyboardOpen !== isKeyboardOpenRef.current) {
      isKeyboardOpenRef.current = keyboardOpen
      cfg.onVirtualKeyboardChange?.(keyboardOpen)

      // When keyboard opens, scroll editor into view
      if (keyboardOpen && cfg.editorRef.current) {
        // Use a small delay to let the viewport settle
        requestAnimationFrame(() => {
          cfg.editorRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
        })
      }
    }
  }, [cfg])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Initialize with current height
    initialViewportHeightRef.current = vv.height

    vv.addEventListener('resize', handleViewportResize)
    vv.addEventListener('scroll', handleViewportResize)

    return () => {
      vv.removeEventListener('resize', handleViewportResize)
      vv.removeEventListener('scroll', handleViewportResize)
    }
  }, [handleViewportResize])

  return {
    isKeyboardOpen: isKeyboardOpenRef.current
  }
}
