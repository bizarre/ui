import React, { useCallback } from 'react'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'
import {
  nextGraphemeEnd,
  prevGraphemeStart,
  snapGraphemeEnd,
  snapGraphemeStart
} from '../internal/string-utils'

export type KeyHandlersConfig = {
  editorRef: React.RefObject<HTMLDivElement | null>
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

type NativeInputEvent = InputEvent & {
  inputType?: string
  data?: string | null
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
  const onBeforeInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const { editorRef } = cfg
      if (!editorRef.current) return

      const nativeAny = event.nativeEvent as unknown as NativeInputEvent
      const data: string | null | undefined = nativeAny.data
      const inputType: string | undefined = nativeAny.inputType

      if (cfg.suppressNextBeforeInputRef.current) {
        cfg.suppressNextBeforeInputRef.current = false
        event.preventDefault()
        return
      }

      if (
        cfg.isComposingRef.current &&
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

        cfg.setValue((currentValue) => {
          const len = currentValue.length
          const safeStart = Math.max(0, Math.min(start, len))
          const safeEnd = Math.max(0, Math.min(end, len))
          let newSelection = safeStart
          let before = ''
          let after = ''
          if (safeStart === safeEnd) {
            // Collapsed
            const active = cfg.getActiveToken()
            const insideToken = !!(
              active &&
              safeStart > active.start &&
              safeStart <= active.end
            )
            if (insideToken) {
              if (inputType === 'deleteContentBackward') {
                const delStart = safeStart - 1
                before = currentValue.slice(0, delStart)
                after = currentValue.slice(safeStart)
                newSelection = delStart
              } else {
                if (safeStart === len) return currentValue
                const delEnd = safeStart + 1
                before = currentValue.slice(0, safeStart)
                after = currentValue.slice(delEnd)
                newSelection = safeStart
              }
            } else {
              if (inputType === 'deleteContentBackward') {
                const clusterStart = prevGraphemeStart(currentValue, safeStart)
                before = currentValue.slice(0, clusterStart)
                after = currentValue.slice(safeStart)
                newSelection = clusterStart
              } else {
                const clusterEnd = nextGraphemeEnd(currentValue, safeStart)
                before = currentValue.slice(0, safeStart)
                after = currentValue.slice(clusterEnd)
                newSelection = safeStart
              }
            }
          } else {
            // Selection
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
          setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
          return before + after
        })
        return
      }

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
        setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
        return newValue
      })
    },
    [cfg]
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
          setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
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
          setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
          return newValue
        })
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        cfg.beginEditSession('delete')
        cfg.setValue((currentValue) => {
          if (!currentValue) return ''
          const len = currentValue.length
          let newSelection = start
          let before: string
          let after: string
          if (range.collapsed) {
            const safeStart = Math.max(0, Math.min(start, len))
            if (safeStart === 0) return currentValue
            const active = cfg.getActiveToken()
            const insideToken = !!(
              active &&
              safeStart > active.start &&
              safeStart <= active.end
            )
            if (insideToken) {
              before = currentValue.slice(0, safeStart - 1)
              after = currentValue.slice(safeStart)
              newSelection = safeStart - 1
            } else {
              const clusterStart = prevGraphemeStart(currentValue, safeStart)
              before = currentValue.slice(0, clusterStart)
              after = currentValue.slice(safeStart)
              newSelection = clusterStart
            }
          } else {
            const end = getAbsoluteOffset(
              editorRef.current!,
              range.endContainer,
              range.endOffset
            )
            const safeStart = Math.max(0, Math.min(start, len))
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
          setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
          return before + after
        })
      }

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
          setTimeout(() => setDomSelection(editorRef.current!, newSelection), 0)
          return before + after
        })
      }
    },
    [cfg]
  )

  return { onBeforeInput, onKeyDown }
}
