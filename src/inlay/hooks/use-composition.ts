import { useCallback, useRef, useState } from 'react'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'

export function useComposition(
  editorRef: React.RefObject<HTMLDivElement | null>,
  serializeRawFromDom: () => string,
  handleSelectionChange: () => void,
  setValue: (updater: (prev: string) => string) => void,
  getCurrentValue: () => string
) {
  const [isComposing, setIsComposing] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const isComposingRef = useRef(false)
  const compositionStartSelectionRef = useRef<{
    start: number
    end: number
  } | null>(null)
  const compositionInitialValueRef = useRef<string | null>(null)
  const suppressNextBeforeInputRef = useRef(false)
  const suppressNextKeydownCommitRef = useRef<null | 'enter' | 'space'>(null)
  const compositionCommitKeyRef = useRef<'enter' | 'space' | null>(null)
  const compositionJustEndedAtRef = useRef<number>(0)
  // Engine detection no longer required; suppression is applied for all engines

  const onCompositionStart = useCallback(() => {
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
    }
    compositionInitialValueRef.current = getCurrentValue()
  }, [editorRef, getCurrentValue])

  const onCompositionUpdate = useCallback(() => {}, [])

  const onCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      const root = editorRef.current
      if (!root) {
        isComposingRef.current = false
        setIsComposing(false)
        return
      }
      suppressNextBeforeInputRef.current = true

      // Build committed value
      let committed = (event as unknown as { data?: string }).data || ''
      const baseValue = compositionInitialValueRef.current ?? getCurrentValue()
      const range = compositionStartSelectionRef.current ?? { start: 0, end: 0 }
      const len = baseValue.length
      const safeStart = Math.max(0, Math.min(range.start, len))
      const safeEnd = Math.max(0, Math.min(range.end, len))
      const before = baseValue.slice(0, safeStart)
      const after = baseValue.slice(safeEnd)

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

      setValue(() => before + committed + after)

      // Force a remount to purge any transient IME DOM artifacts left behind
      setContentKey((k) => k + 1)

      // One-shot suppress the immediate commit keydown regardless of engine
      // Prefer the key recorded during composition; default to 'enter'
      suppressNextKeydownCommitRef.current =
        compositionCommitKeyRef.current ?? 'enter'
      compositionJustEndedAtRef.current = Date.now()

      requestAnimationFrame(() => {
        const r = editorRef.current
        if (!r) return
        setDomSelection(r, safeStart + committed.length)
        handleSelectionChange()
      })

      isComposingRef.current = false
      setIsComposing(false)
      compositionInitialValueRef.current = null
      compositionStartSelectionRef.current = null
      compositionCommitKeyRef.current = null
    },
    [
      editorRef,
      getCurrentValue,
      handleSelectionChange,
      serializeRawFromDom,
      setValue
    ]
  )

  return {
    isComposing,
    isComposingRef,
    suppressNextBeforeInputRef,
    suppressNextKeydownCommitRef,
    compositionCommitKeyRef,
    compositionJustEndedAtRef,
    contentKey,
    onCompositionStart,
    onCompositionUpdate,
    onCompositionEnd
  }
}
