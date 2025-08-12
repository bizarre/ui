import { useCallback, useRef } from 'react'

export type Snapshot = {
  value: string
  selection: { start: number; end: number }
}

export function useHistory(
  getCurrentSnapshot: () => Snapshot,
  applySnapshot: (snap: Snapshot) => void,
  maxHistory: number = 200
) {
  const undoStackRef = useRef<Snapshot[]>([])
  const redoStackRef = useRef<Snapshot[]>([])

  const pushUndoSnapshot = useCallback(() => {
    const snap = getCurrentSnapshot()
    const stack = undoStackRef.current
    if (stack.length >= maxHistory) stack.shift()
    stack.push(snap)
    // New edits invalidate redo history
    redoStackRef.current = []
  }, [getCurrentSnapshot, maxHistory])

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

  const undo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length > 0) {
      const current = getCurrentSnapshot()
      const last = stack.pop()!
      const redoStack = redoStackRef.current
      if (redoStack.length >= maxHistory) redoStack.shift()
      redoStack.push(current)
      applySnapshot(last)
      return true
    }
    return false
  }, [applySnapshot, getCurrentSnapshot, maxHistory])

  const redo = useCallback(() => {
    const redoStack = redoStackRef.current
    if (redoStack.length > 0) {
      const current = getCurrentSnapshot()
      const next = redoStack.pop()!
      const undoStack = undoStackRef.current
      if (undoStack.length >= maxHistory) undoStack.shift()
      undoStack.push(current)
      applySnapshot(next)
      return true
    }
    return false
  }, [applySnapshot, getCurrentSnapshot, maxHistory])

  return {
    undoStackRef,
    redoStackRef,
    pushUndoSnapshot,
    beginEditSession,
    endEditSession,
    undo,
    redo
  }
}
