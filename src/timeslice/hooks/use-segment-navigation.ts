import React, { useCallback, useMemo } from 'react'
import type { DateRange } from './use-time-slice-state'
import { addMonths, addDays, addHours, addMinutes, addYears } from 'date-fns'

export type DateSegmentType =
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'dayPeriod'
  | 'literal'
  | 'year'

export interface Segment {
  type: DateSegmentType
  value: string
  dateKey: 'start' | 'end'
  start: number
  end: number
}

export function buildSegments(
  startDate: Date,
  endDate: Date
): { segments: Segment[]; text: string } {
  const includeYear = startDate.getFullYear() !== endDate.getFullYear()
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(includeYear ? { year: 'numeric' } : {})
  }
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const rawPartsStart = formatter.formatToParts(startDate)
  const rawPartsEnd = formatter.formatToParts(endDate)

  const segments: Segment[] = []
  let cursor = 0
  const separator = ' – '
  const textParts: string[] = []

  function processParts(
    parts: Intl.DateTimeFormatPart[],
    dateKey: 'start' | 'end'
  ) {
    for (const p of parts) {
      // replace "at" with a comma and space
      if (p.type === 'literal' && p.value.includes('at')) {
        textParts.push(', ')
        cursor += 2
        continue
      }

      const len = p.value.length
      textParts.push(p.value)
      if (p.type !== 'literal') {
        segments.push({
          type: p.type as DateSegmentType,
          value: p.value,
          dateKey,
          start: cursor,
          end: cursor + len
        })
      }
      cursor += len
    }
  }

  processParts(rawPartsStart, 'start')
  textParts.push(separator)
  cursor += separator.length
  processParts(rawPartsEnd, 'end')

  const text = textParts.join('')

  return { segments, text }
}

export function adjustDateForSegment(
  date: Date,
  type: DateSegmentType,
  delta: number
): Date {
  switch (type) {
    case 'year':
      return addYears(date, delta)
    case 'month':
      return addMonths(date, delta)
    case 'day':
      return addDays(date, delta)
    case 'hour':
      return addHours(date, delta)
    case 'minute':
      return addMinutes(date, delta)
    case 'dayPeriod': {
      const current = date.getHours()
      const flip = current < 12 ? 12 : -12
      return addHours(date, flip)
    }
    default:
      return date
  }
}

type UseSegmentNavigationProps = {
  inputRef: React.RefObject<HTMLInputElement | null>
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
}

export function useSegmentNavigation({
  inputRef,
  dateRange,
  setDateRange
}: UseSegmentNavigationProps) {
  const segmentsRef = React.useRef<Segment[]>([])
  const activeIdxRef = React.useRef<number>(-1)

  const selectSegment = useCallback(
    (idx: number) => {
      const inputEl = inputRef.current
      if (!inputEl) return
      const seg = segmentsRef.current[idx]
      if (!seg || seg.type === 'literal') return

      inputEl.setSelectionRange(seg.start, seg.end)
      activeIdxRef.current = idx
    },
    [inputRef]
  )

  React.useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      const { segments } = buildSegments(dateRange.startDate, dateRange.endDate)
      segmentsRef.current = segments
    } else {
      segmentsRef.current = []
    }
  }, [dateRange.startDate, dateRange.endDate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const inputEl = inputRef.current
      if (!inputEl || !dateRange.startDate || !dateRange.endDate) return

      const key = e.key
      const segments = segmentsRef.current
      if (segments.length === 0) return

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        const selStart = inputEl.selectionStart!
        const selEnd = inputEl.selectionEnd!

        const isFullySelected =
          selStart === 0 && selEnd === inputEl.value.length
        if (isFullySelected) {
          if (key === 'ArrowLeft') {
            inputEl.setSelectionRange(0, 0)
          } else {
            inputEl.setSelectionRange(
              inputEl.value.length,
              inputEl.value.length
            )
          }
          activeIdxRef.current = -1
          return
        }

        let currentIndex = -1
        const fullySelectedIdx = segments.findIndex(
          (s) =>
            s.type !== 'literal' && selStart === s.start && selEnd === s.end
        )
        const idxStrictlyWithin = segments.findIndex(
          (s) => s.type !== 'literal' && selStart > s.start && selStart < s.end
        )
        currentIndex =
          fullySelectedIdx !== -1 ? fullySelectedIdx : idxStrictlyWithin

        let nextIdx = -1
        if (key === 'ArrowLeft') {
          if (currentIndex !== -1) {
            nextIdx = -1
            for (let i = currentIndex - 1; i >= 0; i--) {
              if (segments[i].type !== 'literal') {
                nextIdx = i
                break
              }
            }
          } else {
            const idxEndingAtCursor = segments.findIndex(
              (s) => s.type !== 'literal' && s.end === selStart
            )
            if (idxEndingAtCursor !== -1) {
              nextIdx = idxEndingAtCursor
            } else {
              nextIdx = -1
              for (let i = segments.length - 1; i >= 0; i--) {
                if (
                  segments[i].type !== 'literal' &&
                  segments[i].start < selStart
                ) {
                  nextIdx = i
                  break
                }
              }
            }
          }
        } else {
          if (currentIndex !== -1) {
            nextIdx = -1
            for (let i = currentIndex + 1; i < segments.length; i++) {
              if (segments[i].type !== 'literal') {
                nextIdx = i
                break
              }
            }
          } else {
            const idxStartingAtCursor = segments.findIndex(
              (s) => s.type !== 'literal' && s.start === selStart
            )
            if (idxStartingAtCursor !== -1) {
              nextIdx = idxStartingAtCursor
            } else {
              nextIdx = -1
              for (let i = 0; i < segments.length; i++) {
                if (
                  segments[i].type !== 'literal' &&
                  segments[i].start > selStart
                ) {
                  nextIdx = i
                  break
                }
              }
            }
          }
        }

        if (nextIdx !== -1) {
          selectSegment(nextIdx)
        } else {
          const newPos = key === 'ArrowLeft' ? 0 : inputEl.value.length
          inputEl.setSelectionRange(newPos, newPos)
          activeIdxRef.current = -1
        }
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault()

        const pos = inputEl.selectionStart!
        let targetIdx = segments.findIndex(
          (s) => s.type !== 'literal' && pos >= s.start && pos <= s.end
        )

        if (targetIdx === -1) {
          targetIdx = activeIdxRef.current
        }

        if (targetIdx === -1) return

        const seg = segments[targetIdx]
        if (!seg || seg.type === 'literal') return

        activeIdxRef.current = targetIdx

        const delta = key === 'ArrowUp' ? 1 : -1
        let newStart = dateRange.startDate!
        let newEnd = dateRange.endDate!

        if (seg.dateKey === 'start') {
          newStart = adjustDateForSegment(dateRange.startDate!, seg.type, delta)
        } else {
          newEnd = adjustDateForSegment(dateRange.endDate!, seg.type, delta)
        }

        const { text, segments: newSegments } = buildSegments(newStart, newEnd)
        if (inputEl) {
          const selectionStartOffset = inputEl.selectionStart! - seg.start
          const selectionEndOffset = inputEl.selectionEnd! - seg.start

          inputEl.value = text
          segmentsRef.current = newSegments

          const updatedSeg = newSegments[targetIdx]
          if (updatedSeg) {
            const newSelStart = Math.max(
              updatedSeg.start,
              Math.min(updatedSeg.end, updatedSeg.start + selectionStartOffset)
            )
            const newSelEnd = Math.max(
              updatedSeg.start,
              Math.min(updatedSeg.end, updatedSeg.start + selectionEndOffset)
            )
            const finalSelStart = Math.min(newSelStart, newSelEnd)
            const finalSelEnd = Math.max(newSelStart, newSelEnd)
            inputEl.setSelectionRange(finalSelStart, finalSelEnd)
            activeIdxRef.current = targetIdx
          } else {
            selectSegment(targetIdx)
          }
        } else {
          segmentsRef.current = newSegments
        }

        setDateRange({ startDate: newStart, endDate: newEnd })
      }
    },
    [
      inputRef,
      dateRange.startDate,
      dateRange.endDate,
      setDateRange,
      selectSegment
    ]
  )

  const selectFirstSegment = useCallback(() => {
    const firstNavigableIndex = segmentsRef.current.findIndex(
      (s) => s.type !== 'literal'
    )
    if (firstNavigableIndex !== -1) {
      selectSegment(firstNavigableIndex)
    }
  }, [selectSegment])

  return useMemo(
    () => ({
      handleKeyDown,
      selectSegment,
      selectFirstSegment,
      segments: segmentsRef.current
    }),
    [handleKeyDown, selectSegment, selectFirstSegment]
  )
}
