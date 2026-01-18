import React, { useCallback, useEffect, useRef } from 'react'
import {
  getAbsoluteOffset,
  setDomSelection,
  serializeRawFromDom
} from '../internal/dom-utils'
import {
  nextGraphemeEnd,
  prevGraphemeStart,
  snapGraphemeEnd,
  snapGraphemeStart
} from '../internal/string-utils'

const isJsdom =
  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')

// Platform detection for iOS-specific handling
const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

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
// When backspace is pressed at the end of a recent multi-char insert, delete the whole chunk.
// iOS has no timeout - we use a generous value to avoid false negatives while still
// clearing stale tracking eventually. The main protection is position matching.
const SWIPE_TEXT_DELETE_TIMEOUT = 30000 // 30 seconds

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
  valueRef: React.MutableRefObject<string> // Current value for sync checks
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

  // Track when we actually prevented a beforeinput event (for MutationObserver to know)
  const lastPreventedTimeRef = useRef<number>(0)

  // Handle beforeinput via native event listener (React's synthetic event is unreliable)
  const handleBeforeInput = useCallback(
    (event: InputEvent) => {
      const { editorRef } = cfg
      if (!editorRef.current) return

      // Helper to mark that we're handling this event (for input handler to know)
      const preventAndMark = () => {
        event.preventDefault()
        lastPreventedTimeRef.current = Date.now()
      }

      const data: string | null | undefined = event.data
      const inputType: string | undefined = event.inputType

      if (cfg.suppressNextBeforeInputRef.current) {
        cfg.suppressNextBeforeInputRef.current = false
        preventAndMark()
        return
      }

      // Immediately after compositionend, WebKit may fire an extra beforeinput inserting a newline.
      // Block it within a short window regardless of current composition state.
      if (
        cfg.compositionJustEndedAtRef.current &&
        Date.now() - cfg.compositionJustEndedAtRef.current < 50 &&
        (inputType === 'insertParagraph' || inputType === 'insertLineBreak')
      ) {
        preventAndMark()
        return
      }

      if (cfg.isComposingRef.current) {
        if (
          inputType === 'insertParagraph' ||
          inputType === 'insertLineBreak'
        ) {
          preventAndMark()
        }
        return
      }

      // Handle text insertions (insertText and insertReplacementText)
      if (inputType === 'insertText' || inputType === 'insertReplacementText') {
        // iOS handling strategy:
        // - WITHOUT newlines: Let iOS modify DOM, sync via input handler (prevents multi-word suggestions)
        // - WITH newlines: Must call preventDefault to avoid React crash with <br> elements
        //   But we need to ensure we have the insertion data before preventing.

        // Use valueRef to check for newlines - DOM might not be updated yet after Enter
        const hasNewlines = cfg.valueRef.current.includes('\n')

        // Get insertion data - needed for controlled path
        const insertData =
          inputType === 'insertReplacementText'
            ? (data ?? event.dataTransfer?.getData('text/plain'))
            : data

        if (isIOS && !hasNewlines) {
          // No newlines: Let iOS modify DOM, sync via input handler
          return
        }

        if (isIOS && hasNewlines && !insertData) {
          // iOS with newlines but no data available - can't handle safely
          // This shouldn't normally happen, but if it does, prevent and skip
          preventAndMark()
          return
        }

        preventAndMark()

        // insertData already obtained above
        if (!insertData) return

        // For insertReplacementText, use target ranges
        let start: number
        let end: number

        if (inputType === 'insertReplacementText') {
          const targetRanges = event.getTargetRanges?.()
          if (!targetRanges || targetRanges.length === 0) return
          const targetRange = targetRanges[0]
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
          // insertText: use current selection
          const pending = pendingSelectionRef.current
          if (
            pending &&
            Date.now() - pending.time < PENDING_SELECTION_TIMEOUT
          ) {
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

        cfg.beginEditSession('insert')
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
          const safeEnd = Math.max(0, Math.min(end, len))
          const before = currentValue.slice(0, safeStart)
          const after = currentValue.slice(safeEnd)

          // Strip leading space when:
          // 1. Inserting after a space (prevent double-space)
          // 2. Inserting at start of line (after newline) - iOS swipe often adds leading space
          // 3. Inserting at start of content (empty before)
          //
          // iOS sometimes sends the space as a SEPARATE event before the word,
          // so we need to handle both single-space and space-prefixed insertions.
          let finalInsertData = insertData
          const shouldStripSpace =
            insertData.startsWith(' ') &&
            (before.endsWith(' ') ||
              before.endsWith('\n') ||
              before.length === 0)

          if (shouldStripSpace) {
            if (insertData === ' ') {
              // Single space at start of line - skip entirely
              return currentValue
            }
            // Multi-char with leading space - strip the space
            finalInsertData = insertData.slice(1)
          }

          const newValue = before + finalInsertData + after
          const newSelection = safeStart + finalInsertData.length

          // Track as multi-char insert for swipe-text backspace detection
          // ONLY track insertText (swipe-typing), NOT insertReplacementText (autocomplete)
          // When user types "hel" and taps "hello" suggestion, backspace should delete char-by-char
          const isSwipeText = inputType === 'insertText'

          if (isSwipeText && finalInsertData.length > 1) {
            lastMultiCharInsertRef.current = {
              start: safeStart,
              end: newSelection,
              data: finalInsertData,
              time: Date.now()
            }
          } else if (
            isSwipeText &&
            finalInsertData === ' ' &&
            lastMultiCharInsertRef.current
          ) {
            // Extend tracking if adding trailing space to multi-char insert
            const lastInsert = lastMultiCharInsertRef.current
            if (safeStart === lastInsert.end) {
              lastMultiCharInsertRef.current = {
                start: lastInsert.start,
                end: newSelection,
                data: lastInsert.data + ' ',
                time: lastInsert.time
              }
            } else {
              lastMultiCharInsertRef.current = null
            }
          } else {
            // Autocomplete (insertReplacementText) or single char - clear swipe tracking
            lastMultiCharInsertRef.current = null
          }

          pendingSelectionRef.current = { pos: newSelection, time: Date.now() }

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
        preventAndMark()

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
        const timeSinceInsert = lastInsert ? Date.now() - lastInsert.time : null
        const matchesEnd = lastInsert ? end === lastInsert.end : false
        const withinTimeout =
          timeSinceInsert !== null &&
          timeSinceInsert < SWIPE_TEXT_DELETE_TIMEOUT

        if (
          inputType === 'deleteContentBackward' &&
          lastInsert &&
          withinTimeout &&
          matchesEnd
        ) {
          // This looks like iOS swipe-text deletion - delete the whole chunk
          // But if the insert started with a space (iOS auto-inserts space before swipe words),
          // preserve that space - only delete the word part
          // EXCEPT: if the character before the insert is also a space (double-space scenario),
          // delete the leading space too to avoid leaving a double space
          const startsWithSpace = lastInsert.data.startsWith(' ')

          cfg.setValue((currentValue) => {
            const charBefore =
              lastInsert.start > 0
                ? currentValue.charAt(lastInsert.start - 1)
                : ''
            const prevIsSpace = charBefore === ' '

            // If starts with space AND prev char is NOT a space, preserve the space
            // Otherwise, delete from the start (including the leading space)
            const preserveLeadingSpace = startsWithSpace && !prevIsSpace
            const deleteStart = preserveLeadingSpace
              ? lastInsert.start + 1
              : lastInsert.start

            // Actually perform the deletion here since we need currentValue
            const before = currentValue.slice(0, deleteStart)
            const after = currentValue.slice(end)
            const newValue = before + after

            pendingSelectionRef.current = {
              pos: deleteStart,
              time: Date.now()
            }

            scheduleSelection(() => {
              const root = editorRef.current
              if (!root || !root.isConnected) return
              setDomSelection(root, deleteStart)
            })

            return newValue
          })

          lastMultiCharInsertRef.current = null // Clear tracking
          return // Early return since we handled the deletion
        }

        cfg.beginEditSession('delete')
        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
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
    },
    [cfg]
  )

  // Attach native beforeinput listener (React's synthetic event is unreliable for beforeinput)
  // Re-attach when contentKey changes (editor element is recreated after IME composition)
  useEffect(() => {
    const editor = cfg.editorRef.current
    if (!editor) return

    const beforeInputListener = (e: Event) => handleBeforeInput(e as InputEvent)
    editor.addEventListener('beforeinput', beforeInputListener)

    // iOS DOM → React state sync:
    // When we don't preventDefault on iOS text insertions, iOS modifies the DOM directly.
    // We use the input event to sync the DOM content back to React state.
    // This uses serializeRawFromDom to correctly handle token elements.
    const inputListener = (e: Event) => {
      if (!isIOS) return // Only needed for iOS

      const ie = e as InputEvent
      const inputType = ie.inputType

      // Handle text insertions (we didn't preventDefault, iOS modified DOM)
      if (
        inputType === 'insertText' ||
        inputType === 'insertReplacementText' ||
        inputType === 'insertFromPaste' ||
        inputType === 'insertFromDrop'
      ) {
        // Skip if we just prevented a beforeinput event (handled it ourselves)
        const now = Date.now()
        if (now - lastPreventedTimeRef.current < 50) {
          return
        }

        // Get the raw DOM content (before stripping invisible chars)
        const rawDomContent = editor.innerText || ''

        // Serialize DOM to get the correct text value (respecting token data-attributes)
        // This strips zero-width spaces and other invisible characters
        const newValue = serializeRawFromDom(editor)

        // Get current cursor position from DOM BEFORE React re-renders
        const domSelection = window.getSelection()
        let cursorPos = newValue.length
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0)
          const rawCursorPos = getAbsoluteOffset(
            editor,
            range.startContainer,
            range.startOffset
          )

          // Adjust cursor position for any invisible characters that were stripped
          // Count how many invisible chars exist before the cursor in raw content
          const beforeCursor = rawDomContent.slice(0, rawCursorPos)
          const invisibleCharsBeforeCursor = (
            beforeCursor.match(/[\u200B\uFEFF]/g) || []
          ).length
          cursorPos = Math.max(
            0,
            Math.min(rawCursorPos - invisibleCharsBeforeCursor, newValue.length)
          )
        }

        // Track multi-char inserts for iOS swipe-text word deletion
        // We need to distinguish between:
        // - Swipe-typing: User swipes across keyboard to type a whole word at once
        //   → Backspace should delete the whole word
        // - Autocomplete/suggestion: User types partial word, taps suggestion
        //   → Backspace should delete char-by-char
        //
        // iOS may send insertText for both! So we can't rely on inputType alone.
        // Better heuristic: swipe-typing inserts AFTER a space or at start.
        // Autocomplete typically replaces text mid-word.
        const isSwipeText = inputType === 'insertText'

        // We need to track if we added a space so we can adjust cursor position
        let addedSpace = false

        cfg.setValue((oldValue) => {
          let finalValue = newValue
          let adjustedCursorPos = cursorPos
          const insertedLength = newValue.length - oldValue.length
          const insertStart = cursorPos - insertedLength

          // iOS often adds a leading space to swipe-typed words.
          // Strip it when inserting after a newline or at the start of content.
          if (insertedLength > 1 && insertStart >= 0) {
            const charBeforeInsert =
              insertStart > 0 ? oldValue.charAt(insertStart - 1) : ''
            const insertedData = newValue.slice(insertStart, cursorPos)

            // Strip leading space if:
            // 1. The inserted text starts with a space
            // 2. AND we're at start of content OR after a newline OR after an existing space
            if (
              insertedData.startsWith(' ') &&
              (insertStart === 0 ||
                charBeforeInsert === '\n' ||
                charBeforeInsert === ' ')
            ) {
              // Remove the leading space from the inserted text
              finalValue =
                oldValue.slice(0, insertStart) +
                insertedData.slice(1) +
                oldValue.slice(insertStart)
              adjustedCursorPos = cursorPos - 1
            }
          }

          // Recalculate for the adjusted value
          const adjustedInsertedLength = finalValue.length - oldValue.length
          const adjustedInsertStart = adjustedCursorPos - adjustedInsertedLength

          // iOS swipe auto-space and autocomplete detection:
          //
          // We need to distinguish:
          // - Swipe-typing: User swipes to type a whole new word → backspace deletes whole word
          // - Autocomplete: User types "hel", taps "hello" → backspace deletes char-by-char
          //
          // Key insight: Autocomplete EXTENDS the last word in oldValue.
          // Swipe-typing ADDS a new word after a space or at the start.
          //
          // So: if oldValue ends with a non-space character (mid-word), this is autocomplete.
          // If oldValue ends with space/newline or is empty, this is swipe-typing.
          if (
            isSwipeText &&
            adjustedInsertedLength > 1 &&
            adjustedInsertStart >= 0
          ) {
            const lastCharOfOld =
              oldValue.length > 0 ? oldValue.charAt(oldValue.length - 1) : ''
            const endsWithWordChar =
              lastCharOfOld && lastCharOfOld !== ' ' && lastCharOfOld !== '\n'

            // If oldValue ends mid-word, this is likely autocomplete
            // (user typed "hel" and tapped "hello" to extend it)
            if (endsWithWordChar) {
              // Autocomplete - don't track for whole-word deletion
              lastMultiCharInsertRef.current = null
            } else {
              // Swipe-typing (oldValue ends with space, newline, or is empty)
              const charBeforeAdjustedInsert =
                adjustedInsertStart > 0
                  ? oldValue.charAt(adjustedInsertStart - 1)
                  : ''
              const adjustedInsertedData = finalValue.slice(
                adjustedInsertStart,
                adjustedCursorPos
              )

              if (
                adjustedInsertStart > 0 &&
                charBeforeAdjustedInsert &&
                charBeforeAdjustedInsert !== ' ' &&
                charBeforeAdjustedInsert !== '\n' &&
                !adjustedInsertedData.startsWith(' ')
              ) {
                // Need to add a space before the inserted word
                finalValue =
                  oldValue.slice(0, adjustedInsertStart) +
                  ' ' +
                  adjustedInsertedData +
                  oldValue.slice(adjustedInsertStart)
                addedSpace = true

                // Track with the added space
                lastMultiCharInsertRef.current = {
                  start: adjustedInsertStart,
                  end: adjustedCursorPos + 1,
                  data: ' ' + adjustedInsertedData,
                  time: Date.now()
                }
              } else {
                // Normal swipe - track for whole-word deletion
                lastMultiCharInsertRef.current = {
                  start: adjustedInsertStart,
                  end: adjustedCursorPos,
                  data: adjustedInsertedData,
                  time: Date.now()
                }
              }
            }
          } else if (isSwipeText && adjustedInsertedLength === 1) {
            // Single char from swipe - check if it's a trailing space after a swipe
            const insertedChar = finalValue.charAt(adjustedCursorPos - 1)
            const lastInsert = lastMultiCharInsertRef.current
            if (
              insertedChar === ' ' &&
              lastInsert &&
              adjustedInsertStart === lastInsert.end
            ) {
              // Extend the tracking to include the trailing space
              lastMultiCharInsertRef.current = {
                start: lastInsert.start,
                end: adjustedCursorPos,
                data: lastInsert.data + ' ',
                time: lastInsert.time
              }
            } else {
              // Regular single char, clear tracking
              lastMultiCharInsertRef.current = null
            }
          } else if (!isSwipeText) {
            // Autocomplete/suggestion (insertReplacementText) - clear swipe tracking
            // User should be able to backspace char-by-char
            lastMultiCharInsertRef.current = null
          }

          // Update pending selection for rapid input handling
          const finalCursorPos = addedSpace
            ? adjustedCursorPos + 1
            : adjustedCursorPos
          pendingSelectionRef.current = {
            pos: finalCursorPos,
            time: Date.now()
          }

          return finalValue
        })

        // Restore caret position after React re-renders
        // Use pendingSelectionRef since the actual position is calculated inside setValue
        scheduleSelection(() => {
          const root = cfg.editorRef.current
          if (!root || !root.isConnected) return
          const pending = pendingSelectionRef.current
          const pos = pending ? pending.pos : cursorPos
          setDomSelection(root, pos)
        })
      }

      // After deletions, sync DOM → React to ensure they stay in sync
      // This catches any cases where our deletion logic didn't perfectly match iOS's DOM state
      if (
        inputType === 'deleteContentBackward' ||
        inputType === 'deleteContentForward' ||
        inputType === 'deleteWordBackward' ||
        inputType === 'deleteWordForward' ||
        inputType === 'deleteSoftLineBackward' ||
        inputType === 'deleteSoftLineForward'
      ) {
        // Small delay to let our beforeinput handler complete first
        setTimeout(() => {
          const root = cfg.editorRef.current
          if (!root || !root.isConnected) return

          const domValue = serializeRawFromDom(root)
          cfg.setValue((currentValue) => {
            // Only sync if they're different (our handler might have already set it correctly)
            if (currentValue !== domValue) {
              return domValue
            }
            return currentValue
          })
        }, 0)
      }
    }
    editor.addEventListener('input', inputListener)

    return () => {
      editor.removeEventListener('beforeinput', beforeInputListener)
      editor.removeEventListener('input', inputListener)
    }
  }, [cfg.editorRef, cfg.contentKey, handleBeforeInput, cfg.setValue])

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

            // iOS fix: Reset autocomplete state after newline.
            // iOS sometimes doesn't see <br> as a word boundary and suggests
            // merged words like "helloworld" instead of treating them separately.
            // Toggle autocomplete attribute to reset iOS's autocomplete context
            // without dismissing the keyboard (unlike blur/focus).
            if (isIOS) {
              const currentAutocomplete = root.getAttribute('autocomplete')
              root.setAttribute('autocomplete', 'off')
              requestAnimationFrame(() => {
                if (root.isConnected) {
                  if (currentAutocomplete) {
                    root.setAttribute('autocomplete', currentAutocomplete)
                  } else {
                    root.removeAttribute('autocomplete')
                  }
                }
              })
            }
          })
          return newValue
        })
      }

      // On iOS, don't intercept space - let it flow to beforeinput/input
      // so that iOS multi-word keyboard suggestions can work.
      // On desktop, handle space directly for consistent behavior.
      if (event.key === ' ' && !isIOS) {
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
