import React, { useCallback, useEffect, useRef } from 'react'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'
import {
  nextGraphemeEnd,
  prevGraphemeStart,
  snapGraphemeEnd,
  snapGraphemeStart
} from '../internal/string-utils'

const isJsdom =
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')

function scheduleSelection(cb: () => void) {
  if (isJsdom) {
    setTimeout(cb, 0)
  } else if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(cb)
  } else {
    setTimeout(cb, 0)
  }
}

// Timeout for pending selection validity (ms)
const PENDING_SELECTION_TIMEOUT = 100

// Timeout for iOS swipe-text word deletion detection (ms)
// If backspace is pressed within this time after a multi-char insert, delete the whole chunk
const SWIPE_TEXT_DELETE_TIMEOUT = 1000

export type KeyHandlersConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
  contentKey: number // Changes when editor element is recreated (e.g., after IME composition)
  multiline: boolean
  onKeyDownProp?: (event: React.KeyboardEvent<HTMLDivElement>) => boolean | void
  beginEditSession: (type: 'insert' | 'delete') => void
  endEditSession: () => void
  pushUndoSnapshot: () => void
  undo: () => boolean
  redo: () => boolean
  isComposingRef: React.MutableRefObject<boolean>
  compositionCommitKeyRef: React.MutableRefObject<'enter' | 'space' | null>
  suppressNextBeforeInputRef: React.MutableRefObject<boolean>
  suppressNextKeydownCommitRef: React.MutableRefObject<null | 'enter' | 'space'>
  compositionJustEndedAtRef: React.MutableRefObject<number>
  setValue: React.Dispatch<React.SetStateAction<string>>
  getActiveToken: () => { start: number; end: number } | null
}

function selectionIntersectsToken(editor: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const rng = sel.getRangeAt(0)
  const tokens = editor.querySelectorAll('[data-token-text]')
  for (let i = 0; i < tokens.length; i++) {
    const el = tokens[i]
    const rangeIntersects = rng.intersectsNode
    if (typeof rangeIntersects === 'function') {
      if (rangeIntersects.call(rng, el)) return true
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

export function useKeyHandlers(cfg: KeyHandlersConfig) {
  // Track pending selection to avoid stale window.getSelection() during rapid input
  const pendingSelectionRef = useRef<{ pos: number; time: number } | null>(null)

  // Track last multi-char insert for iOS swipe-text word deletion detection
  // When user swipe-types a word and presses backspace, iOS only sends one
  // deleteContentBackward event for the last char, but expects the whole word deleted
  const lastMultiCharInsertRef = useRef<{
    start: number
    end: number
    data: string // Track the actual inserted text for space preservation
    time: number
  } | null>(null)

  // Handle beforeinput via native event listener (React's synthetic event is unreliable)
  const handleBeforeInput = useCallback(
    (event: InputEvent) => {
      const { editorRef } = cfg
      if (!editorRef.current) return

      const data: string | null | undefined = event.data
      const inputType: string | undefined = event.inputType

      if (cfg.suppressNextBeforeInputRef.current) {
        cfg.suppressNextBeforeInputRef.current = false
        event.preventDefault()
        return
      }

      // Immediately after compositionend, WebKit may fire an extra beforeinput inserting a newline.
      // Block it within a short window regardless of current composition state.
      if (
        cfg.compositionJustEndedAtRef.current &&
        Date.now() - cfg.compositionJustEndedAtRef.current < 50 &&
        (inputType === 'insertParagraph' || inputType === 'insertLineBreak')
      ) {
        event.preventDefault()
        return
      }

      if (cfg.isComposingRef.current) {
        if (
          inputType === 'insertParagraph' ||
          inputType === 'insertLineBreak'
        ) {
          event.preventDefault()
        }
        return
      }

      // Android GBoard sends insertReplacementText for word predictions/autocomplete
      // This replaces text in a specific range with new text
      if (inputType === 'insertReplacementText') {
        event.preventDefault()

        // Get the target range from the native event
        const targetRanges = event.getTargetRanges?.()
        if (!targetRanges || targetRanges.length === 0 || !data) return

        const targetRange = targetRanges[0]
        const replaceStart = getAbsoluteOffset(
          editorRef.current,
          targetRange.startContainer,
          targetRange.startOffset
        )
        const replaceEnd = getAbsoluteOffset(
          editorRef.current,
          targetRange.endContainer,
          targetRange.endOffset
        )

        cfg.beginEditSession('insert')
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(replaceStart, len))
          const safeEnd = Math.max(0, Math.min(replaceEnd, len))
          const before = currentValue.slice(0, safeStart)
          const after = currentValue.slice(safeEnd)
          const newValue = before + data + after
          const newSelection = safeStart + data.length
          scheduleSelection(() => {
            const root = editorRef.current
            if (!root || !root.isConnected) return
            setDomSelection(root, newSelection)
          })
          return newValue
        })
        return
      }

      // Handle various delete input types (including mobile-specific ones)
      if (
        inputType === 'deleteContentBackward' ||
        inputType === 'deleteContentForward' ||
        inputType === 'deleteWordBackward' ||
        inputType === 'deleteWordForward' ||
        inputType === 'deleteSoftLineBackward' ||
        inputType === 'deleteSoftLineForward'
      ) {
        event.preventDefault()

        // iOS swipe-text fix: Use targetRanges when available AND the nodes are still connected.
        // After rapid beforeinput events (e.g., iOS word deletion), React re-renders replace
        // text nodes, making subsequent targetRanges point to orphaned nodes.
        // In that case, use pending selection which tracks the expected cursor position.
        const targetRanges = event.getTargetRanges?.()

        let start: number
        let end: number

        // Check if targetRanges point to nodes still in the DOM
        const targetRange = targetRanges?.[0]
        const targetNodesConnected =
          targetRange &&
          editorRef.current?.contains(targetRange.startContainer) &&
          editorRef.current?.contains(targetRange.endContainer)

        if (targetRange && targetNodesConnected) {
          start = getAbsoluteOffset(
            editorRef.current,
            targetRange.startContainer,
            targetRange.startOffset
          )
          end = getAbsoluteOffset(
            editorRef.current,
            targetRange.endContainer,
            targetRange.endOffset
          )
        } else {
          // Fallback: Use pending selection (for rapid deletes) or window.getSelection()
          const pending = pendingSelectionRef.current
          if (
            pending &&
            Date.now() - pending.time < PENDING_SELECTION_TIMEOUT
          ) {
            // Use pending selection for rapid iOS word deletion
            start = pending.pos
            end = pending.pos
          } else {
            const domSelection = window.getSelection()
            if (!domSelection || !domSelection.rangeCount) return
            const range = domSelection.getRangeAt(0)
            start = getAbsoluteOffset(
              editorRef.current,
              range.startContainer,
              range.startOffset
            )
            end = getAbsoluteOffset(
              editorRef.current,
              range.endContainer,
              range.endOffset
            )
          }
        }

        // iOS swipe-text word deletion detection:
        // When user swipe-types a word and presses backspace, iOS sends ONE
        // deleteContentBackward event with targetRange for just the last char.
        // But the user expects the whole word to be deleted.
        // Detect this by checking if we're deleting at the end of a recent multi-char insert.
        const lastInsert = lastMultiCharInsertRef.current
        let swipeTextStart: number | null = null
        if (
          inputType === 'deleteContentBackward' &&
          lastInsert &&
          Date.now() - lastInsert.time < SWIPE_TEXT_DELETE_TIMEOUT &&
          end === lastInsert.end // Deleting from the end of the inserted chunk
        ) {
          // This looks like iOS swipe-text deletion - delete the whole chunk
          // But if the insert started with a space (iOS auto-inserts space before swipe words),
          // preserve that space - only delete the word part
          const startsWithSpace = lastInsert.data.startsWith(' ')
          swipeTextStart = startsWithSpace
            ? lastInsert.start + 1
            : lastInsert.start
          lastMultiCharInsertRef.current = null // Clear tracking
        }

        cfg.beginEditSession('delete')
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          // If swipe-text deletion detected, override start to delete whole chunk
          const effectiveStart =
            swipeTextStart !== null ? swipeTextStart : start
          const safeStart = Math.max(0, Math.min(effectiveStart, len))
          const safeEnd = Math.max(0, Math.min(end, len))
          let newSelection = safeStart
          let before = ''
          let after = ''

          // For deleteContentBackward:
          // - If there's a range selection (safeStart !== safeEnd), delete the entire selection
          // - If it's a collapsed cursor, delete one grapheme backward
          if (inputType === 'deleteContentBackward') {
            // Handle range selection (delete entire selected range)
            if (safeStart !== safeEnd) {
              if (selectionIntersectsToken(editorRef.current!)) {
                before = currentValue.slice(0, safeStart)
                after = currentValue.slice(safeEnd)
                newSelection = safeStart
              } else {
                const adjStart = snapGraphemeStart(currentValue, safeStart)
                const adjEnd = snapGraphemeEnd(currentValue, safeEnd)
                before = currentValue.slice(0, adjStart)
                after = currentValue.slice(adjEnd)
                newSelection = adjStart
              }
            } else {
              // Collapsed cursor - delete one char/grapheme backward
              const cursorPos = safeEnd
              if (cursorPos === 0) return currentValue
              const active = cfg.getActiveToken()
              const insideToken = !!(
                active &&
                cursorPos > active.start &&
                cursorPos <= active.end
              )
              if (insideToken) {
                const delStart = cursorPos - 1
                before = currentValue.slice(0, delStart)
                after = currentValue.slice(cursorPos)
                newSelection = delStart
              } else {
                const clusterStart = prevGraphemeStart(currentValue, cursorPos)
                before = currentValue.slice(0, clusterStart)
                after = currentValue.slice(cursorPos)
                newSelection = clusterStart
              }
            }
          } else if (inputType === 'deleteContentForward') {
            const cursorPos = safeStart
            if (cursorPos === len) return currentValue
            const active = cfg.getActiveToken()
            const insideToken = !!(
              active &&
              cursorPos >= active.start &&
              cursorPos < active.end
            )
            if (insideToken) {
              const delEnd = cursorPos + 1
              before = currentValue.slice(0, cursorPos)
              after = currentValue.slice(delEnd)
              newSelection = cursorPos
            } else {
              const clusterEnd = nextGraphemeEnd(currentValue, cursorPos)
              before = currentValue.slice(0, cursorPos)
              after = currentValue.slice(clusterEnd)
              newSelection = cursorPos
            }
          } else {
            // Other delete types (word, line) - use the provided range
            if (selectionIntersectsToken(editorRef.current!)) {
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(safeEnd)
              newSelection = safeStart
            } else {
              const adjStart = snapGraphemeStart(currentValue, safeStart)
              const adjEnd = snapGraphemeEnd(currentValue, safeEnd)
              before = currentValue.slice(0, adjStart)
              after = currentValue.slice(adjEnd)
              newSelection = adjStart
            }
          }
          // Store pending selection for rapid input handling
          pendingSelectionRef.current = { pos: newSelection, time: Date.now() }

          scheduleSelection(() => {
            const root = editorRef.current
            if (!root || !root.isConnected) return
            setDomSelection(root, newSelection)
          })
          return before + after
        })
        return
      }

      event.preventDefault()

      // Use pending selection if available and recent (to handle rapid typing)
      let start: number
      let end: number
      const pending = pendingSelectionRef.current
      if (pending && Date.now() - pending.time < PENDING_SELECTION_TIMEOUT) {
        start = pending.pos
        end = pending.pos
      } else {
        const domSelection = window.getSelection()
        if (!domSelection || !domSelection.rangeCount) return
        const range = domSelection.getRangeAt(0)
        start = getAbsoluteOffset(
          editorRef.current,
          range.startContainer,
          range.startOffset
        )
        end = getAbsoluteOffset(
          editorRef.current,
          range.endContainer,
          range.endOffset
        )
      }

      if (!data) return
      cfg.beginEditSession('insert')

      cfg.setValue((currentValue) => {
        const len = currentValue.length
        const safeStart = Math.max(0, Math.min(start, len))
        const safeEnd = Math.max(0, Math.min(end, len))
        const before = currentValue.slice(0, safeStart)
        const after = currentValue.slice(safeEnd)
        const newValue = before + data + after
        const newSelection = safeStart + data.length

        // Store pending selection for rapid input handling
        pendingSelectionRef.current = { pos: newSelection, time: Date.now() }

        // Track multi-char inserts for iOS swipe-text word deletion
        // When user swipe-types, iOS inserts the whole word at once
        if (data.length > 1) {
          lastMultiCharInsertRef.current = {
            start: safeStart,
            end: newSelection,
            data: data, // Store for space preservation check
            time: Date.now()
          }
        } else {
          // Single char insert clears the tracking (user is typing normally)
          lastMultiCharInsertRef.current = null
        }

        scheduleSelection(() => {
          const root = editorRef.current
          if (!root || !root.isConnected) return
          setDomSelection(root, newSelection)
        })
        return newValue
      })
    },
    [cfg]
  )

  // Attach native beforeinput listener (React's synthetic event is unreliable for beforeinput)
  // Re-attach when contentKey changes (editor element is recreated after IME composition)
  useEffect(() => {
    const editor = cfg.editorRef.current
    if (!editor) return

    const listener = (e: Event) => handleBeforeInput(e as InputEvent)
    editor.addEventListener('beforeinput', listener)
    return () => editor.removeEventListener('beforeinput', listener)
  }, [cfg.editorRef, cfg.contentKey, handleBeforeInput])

  // Keep onBeforeInput as a no-op for backward compatibility (actual handling is via native listener)
  const onBeforeInput = useCallback(() => {
    // No-op: beforeinput is handled via native event listener
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // One-shot suppression for the immediate keydown fired after compositionend (WebKit bug)
      if (cfg.suppressNextKeydownCommitRef.current) {
        const sup = cfg.suppressNextKeydownCommitRef.current
        const isEnter = event.key === 'Enter' || event.key === 'Return'
        const isSpace = event.key === ' '
        if ((sup === 'enter' && isEnter) || (sup === 'space' && isSpace)) {
          event.preventDefault()
          event.stopPropagation()
          cfg.suppressNextKeydownCommitRef.current = null
          return
        }
        // Clear suppression if next key is different
        cfg.suppressNextKeydownCommitRef.current = null
      }

      if (cfg.onKeyDownProp?.(event)) return

      if (!cfg.multiline && event.key === 'Enter') {
        event.preventDefault()
        return
      }

      if (
        event.key.startsWith('Arrow') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        if (!(event.key === 'Shift')) cfg.endEditSession()
      }

      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        const isUndo = event.key.toLowerCase() === 'z' && !event.shiftKey
        const isRedo =
          (event.key.toLowerCase() === 'z' && event.shiftKey) ||
          event.key.toLowerCase() === 'y'
        if (isUndo) {
          if (cfg.undo()) {
            event.preventDefault()
            return
          }
        } else if (isRedo) {
          if (cfg.redo()) {
            event.preventDefault()
            return
          }
        }
      }

      const { editorRef } = cfg
      if (!editorRef.current) return
      const domSelection = window.getSelection()
      if (!domSelection || !domSelection.rangeCount) return

      const range = domSelection.getRangeAt(0)
      const start = getAbsoluteOffset(
        editorRef.current,
        range.startContainer,
        range.startOffset
      )

      if (cfg.isComposingRef.current) {
        if (event.key === 'Enter' || event.key === 'Return') {
          event.preventDefault()
          event.stopPropagation()
          cfg.compositionCommitKeyRef.current = 'enter'
          return
        }
        if (event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          cfg.compositionCommitKeyRef.current = 'space'
          return
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const end = getAbsoluteOffset(
          editorRef.current,
          range.endContainer,
          range.endOffset
        )
        cfg.pushUndoSnapshot()
        cfg.endEditSession()
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
          const safeEnd = Math.max(0, Math.min(end, len))
          const before = currentValue.slice(0, safeStart)
          const after = currentValue.slice(safeEnd)
          const newValue = before + '\n' + after
          const newSelection = safeStart + 1
          scheduleSelection(() => {
            const root = editorRef.current
            if (!root || !root.isConnected) return
            setDomSelection(root, newSelection)
          })
          return newValue
        })
      }

      if (event.key === ' ') {
        event.preventDefault()
        cfg.beginEditSession('insert')
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
          const safeEnd = Math.max(0, Math.min(start, len))
          const before = currentValue.slice(0, safeStart)
          const after = currentValue.slice(safeEnd)
          const newValue = before + ' ' + after
          const newSelection = safeStart + 1
          scheduleSelection(() => {
            const root = editorRef.current
            if (!root || !root.isConnected) return
            setDomSelection(root, newSelection)
          })
          return newValue
        })
      }

      // Backspace is handled by beforeinput (deleteContentBackward) to support
      // iOS swipe-text word deletion which fires multiple beforeinput events.
      // Not calling preventDefault here allows beforeinput to fire.

      if (event.key === 'Delete') {
        event.preventDefault()
        cfg.beginEditSession('delete')
        cfg.setValue((currentValue) => {
          if (!currentValue) return ''
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
          let newSelection = safeStart
          let before: string
          let after: string
          if (range.collapsed) {
            if (safeStart === len) return currentValue
            const active = cfg.getActiveToken()
            const insideToken = !!(
              active &&
              safeStart >= active.start &&
              safeStart < active.end
            )
            if (insideToken) {
              const delEnd = safeStart + 1
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(delEnd)
              newSelection = safeStart
            } else {
              const clusterEnd = nextGraphemeEnd(currentValue, safeStart)
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(clusterEnd)
              newSelection = safeStart
            }
          } else {
            const end = getAbsoluteOffset(
              editorRef.current!,
              range.endContainer,
              range.endOffset
            )
            const safeEnd = Math.max(0, Math.min(end, len))
            if (selectionIntersectsToken(editorRef.current!)) {
              before = currentValue.slice(0, safeStart)
              after = currentValue.slice(safeEnd)
              newSelection = safeStart
            } else {
              const adjStart = snapGraphemeStart(currentValue, safeStart)
              const adjEnd = snapGraphemeEnd(currentValue, safeEnd)
              before = currentValue.slice(0, adjStart)
              after = currentValue.slice(adjEnd)
              newSelection = adjStart
            }
          }
          scheduleSelection(() => {
            const root = editorRef.current
            if (!root || !root.isConnected) return
            setDomSelection(root, newSelection)
          })
          return before + after
        })
      }
    },
    [cfg]
  )

  return { onBeforeInput, onKeyDown }
}
