import React, { useCallback, useMemo, useEffect, useState } from 'react'
import type { DateRange } from '../use-time-slice-state'
import { addMonths, addDays, addHours, addMinutes, addYears } from 'date-fns'
import '@formatjs/intl-datetimeformat/polyfill'
import '@formatjs/intl-datetimeformat/locale-data/en'
import '@formatjs/intl-datetimeformat/add-all-tz'

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
  endDate: Date,
  timeZone: string
): { segments: Segment[]; text: string } {
  const includeYear = startDate.getFullYear() !== endDate.getFullYear()
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
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
    parts: Intl.DateTimeFormatPart[], // Use native TS type, polyfill should conform or we adjust here
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

      const partTypeFromFormatter = p.type as string // Treat as string initially
      let mappedType: DateSegmentType

      // Map from Formatter's part type to our DateSegmentType
      switch (partTypeFromFormatter) {
        case 'month':
        case 'day':
        case 'year':
        case 'hour':
        case 'minute':
        case 'literal':
          mappedType = partTypeFromFormatter as DateSegmentType
          break
        case 'ampm': // FormatJS might use 'ampm' for dayPeriod
        case 'dayPeriod': // Native Intl uses 'dayPeriod'
          mappedType = 'dayPeriod'
          break
        default:
          mappedType = partTypeFromFormatter as DateSegmentType // Attempt direct cast, may need 'unknown'
          // console.warn(`Unknown segment part type from formatter: ${partTypeFromFormatter}, value: ${p.value}`);
          break
      }

      if (mappedType !== 'literal') {
        segments.push({
          type: mappedType,
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
  delta: number,
  timeZone: string
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
      const hourInTimeZone = parseInt(
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone
        }).format(date),
        10
      )
      const flip = hourInTimeZone < 12 ? 12 : -12
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
  timeZone: string
  onFocusPortalRequested?: () => void
  setOpenPortal?: (open: boolean) => void
}

export function useSegmentNavigation({
  inputRef,
  dateRange,
  setDateRange,
  timeZone,
  onFocusPortalRequested,
  setOpenPortal
}: UseSegmentNavigationProps) {
  const segmentsRef = React.useRef<Segment[]>([])
  const activeIdxRef = React.useRef<number>(-1)
  const [segmentVersion, setSegmentVersion] = useState(0)

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

  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      const { segments } = buildSegments(
        dateRange.startDate,
        dateRange.endDate,
        timeZone
      )
      segmentsRef.current = segments
      activeIdxRef.current = -1
    } else {
      segmentsRef.current = []
      activeIdxRef.current = -1
    }
    setSegmentVersion((v) => v + 1)
  }, [dateRange.startDate, dateRange.endDate, timeZone])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const inputEl = inputRef.current

      if (!inputEl) {
        if (e.key === 'ArrowDown' && onFocusPortalRequested) {
          const tempInput = e.target as HTMLInputElement
          if (
            tempInput.selectionStart === 0 &&
            tempInput.selectionEnd === tempInput.value.length &&
            tempInput.value.length > 0
          ) {
            e.preventDefault()
            onFocusPortalRequested()
          }
        }
        return
      }

      const key = e.key

      if (key === 'Tab' && !e.shiftKey && onFocusPortalRequested) {
        let shouldTabToPortal = false
        if (!dateRange.startDate || !dateRange.endDate) {
          shouldTabToPortal = true
        } else {
          const canonicalText = buildSegments(
            dateRange.startDate,
            dateRange.endDate,
            timeZone
          ).text
          if (inputEl && inputEl.value !== canonicalText) {
            shouldTabToPortal = true
          }
        }

        if (shouldTabToPortal) {
          e.preventDefault()
          onFocusPortalRequested()
          return
        }
      }

      if (!dateRange.startDate || !dateRange.endDate) {
        if (onFocusPortalRequested && key === 'ArrowDown') {
          e.preventDefault()
          onFocusPortalRequested()
          return
        }
      }

      const segments = segmentsRef.current

      if (
        segments.length === 0 &&
        !(
          key === 'ArrowDown' ||
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'Tab'
        )
      )
        return

      const getCombinedRange = (dateKey: 'start' | 'end') => {
        const relevantSegments = segments.filter(
          (s) => s.dateKey === dateKey && s.type !== 'literal'
        )
        if (relevantSegments.length === 0) return null
        const minStart = Math.min(...relevantSegments.map((s) => s.start))
        const maxEnd = Math.max(...relevantSegments.map((s) => s.end))
        return { start: minStart, end: maxEnd }
      }

      const selStart = inputEl.selectionStart!
      const selEnd = inputEl.selectionEnd!
      const inputValueLength = inputEl.value.length
      const isInputFullySelected =
        selStart === 0 && selEnd === inputValueLength && inputValueLength > 0
      const isInputEmpty = inputValueLength === 0

      if (key === 'Enter') {
        e.preventDefault()
        if (setOpenPortal) {
          setOpenPortal(false)
        }
        inputEl.blur()
        return
      }

      if ((isInputFullySelected || isInputEmpty) && onFocusPortalRequested) {
        if (key === 'ArrowDown') {
          e.preventDefault()
          onFocusPortalRequested()
          return
        }
        if (key === 'Tab' && !e.shiftKey) {
          e.preventDefault()
          onFocusPortalRequested()
          return
        }
      }

      if (key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const startRangeTab = getCombinedRange('start')
        const endRangeTab = getCombinedRange('end')

        if (!startRangeTab || !endRangeTab) return

        if (selStart === startRangeTab.start && selEnd === startRangeTab.end) {
          inputEl.setSelectionRange(endRangeTab.start, endRangeTab.end)
        } else {
          inputEl.setSelectionRange(startRangeTab.start, startRangeTab.end)
        }
        activeIdxRef.current = -1
        return
      }

      if (key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const startRangeTab = getCombinedRange('start')
        const endRangeTab = getCombinedRange('end')

        if (!startRangeTab || !endRangeTab) return

        if (selStart === endRangeTab.start && selEnd === endRangeTab.end) {
          inputEl.setSelectionRange(startRangeTab.start, startRangeTab.end)
        } else {
          inputEl.setSelectionRange(endRangeTab.start, endRangeTab.end)
        }
        activeIdxRef.current = -1
        return
      }

      const findFirstNavigableSegmentIndex = (
        dateKey: 'start' | 'end'
      ): number => {
        for (let i = 0; i < segments.length; i++) {
          if (
            segments[i].dateKey === dateKey &&
            segments[i].type !== 'literal'
          ) {
            return i
          }
        }
        return -1
      }

      const findLastNavigableSegmentIndex = (
        dateKey: 'start' | 'end'
      ): number => {
        for (let i = segments.length - 1; i >= 0; i--) {
          if (
            segments[i].dateKey === dateKey &&
            segments[i].type !== 'literal'
          ) {
            return i
          }
        }
        return -1
      }

      const startRangeNav = getCombinedRange('start')
      const endRangeNav = getCombinedRange('end')

      if (
        startRangeNav &&
        selStart === startRangeNav.start &&
        selEnd === startRangeNav.end
      ) {
        if (key === 'ArrowLeft') {
          e.preventDefault()
          const firstIdx = findFirstNavigableSegmentIndex('start')
          if (firstIdx !== -1) selectSegment(firstIdx)
          return
        }
        if (key === 'ArrowRight') {
          e.preventDefault()
          const lastIdx = findLastNavigableSegmentIndex('start')
          if (lastIdx !== -1) selectSegment(lastIdx)
          return
        }
      } else if (
        endRangeNav &&
        selStart === endRangeNav.start &&
        selEnd === endRangeNav.end
      ) {
        if (key === 'ArrowLeft') {
          e.preventDefault()
          const firstIdx = findFirstNavigableSegmentIndex('end')
          if (firstIdx !== -1) selectSegment(firstIdx)
          return
        }
        if (key === 'ArrowRight') {
          e.preventDefault()
          const lastIdx = findLastNavigableSegmentIndex('end')
          if (lastIdx !== -1) selectSegment(lastIdx)
          return
        }
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        if (!inputEl) return

        const isGenericInputFullySelected =
          inputEl.selectionStart === 0 &&
          inputEl.selectionEnd === inputEl.value.length

        if (isGenericInputFullySelected) {
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

        const startRangeNav = getCombinedRange('start')
        const endRangeNav = getCombinedRange('end')

        const isFullStartDateSelected =
          startRangeNav &&
          selStart === startRangeNav.start &&
          selEnd === startRangeNav.end
        const isFullEndDateSelected =
          endRangeNav &&
          selStart === endRangeNav.start &&
          selEnd === endRangeNav.end

        if (isFullStartDateSelected || isFullEndDateSelected) {
          return
        }

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

        const deltaVal = key === 'ArrowUp' ? 1 : -1
        let newStart = dateRange.startDate!
        let newEnd = dateRange.endDate!

        if (seg.dateKey === 'start') {
          newStart = adjustDateForSegment(
            dateRange.startDate!,
            seg.type,
            deltaVal,
            timeZone
          )
        } else {
          newEnd = adjustDateForSegment(
            dateRange.endDate!,
            seg.type,
            deltaVal,
            timeZone
          )
        }

        const { text, segments: newSegments } = buildSegments(
          newStart,
          newEnd,
          timeZone
        )
        if (inputEl) {
          const selectionStartOffset = inputEl.selectionStart! - seg.start
          const selectionEndOffset = inputEl.selectionEnd! - seg.start

          inputEl.value = text
          segmentsRef.current = newSegments
          setSegmentVersion((v) => v + 1)

          let newActiveSegmentIdx = -1

          // 1. Try to find the semantically equivalent segment (same type, same dateKey)
          const originalSegType = seg.type
          const originalSegDateKey = seg.dateKey
          const equivalentNewSegmentIdx = newSegments.findIndex(
            (s) =>
              s.type === originalSegType && s.dateKey === originalSegDateKey
          )

          if (equivalentNewSegmentIdx !== -1) {
            newActiveSegmentIdx = equivalentNewSegmentIdx
          } else {
            // 2. Fallback: Try to find a segment at the original index if it's still valid and navigable
            //    This helps if the type changed but the position is still somewhat relevant.
            if (
              targetIdx < newSegments.length &&
              newSegments[targetIdx]?.type !== 'literal'
            ) {
              newActiveSegmentIdx = targetIdx
            } else {
              // 3. Fallback: Select the first navigable segment in the new list
              const firstNavigableNewIdx = newSegments.findIndex(
                (s) => s.type !== 'literal'
              )
              if (firstNavigableNewIdx !== -1) {
                newActiveSegmentIdx = firstNavigableNewIdx
              }
            }
          }

          if (newActiveSegmentIdx !== -1) {
            const segmentToSelect = newSegments[newActiveSegmentIdx]

            // If the segment type and dateKey are the same as the original adjusted segment,
            // try to restore the partial selection. Otherwise, select the whole segment.
            if (
              segmentToSelect.type === originalSegType &&
              segmentToSelect.dateKey === originalSegDateKey
            ) {
              const newSelStart = Math.max(
                segmentToSelect.start,
                Math.min(
                  segmentToSelect.end,
                  segmentToSelect.start + selectionStartOffset
                )
              )
              const newSelEnd = Math.max(
                segmentToSelect.start,
                Math.min(
                  segmentToSelect.end,
                  segmentToSelect.start + selectionEndOffset
                )
              )
              // Ensure start is not after end, especially if original selection was a caret (start === end)
              const finalSelStart = Math.min(newSelStart, newSelEnd)
              const finalSelEnd = Math.max(newSelStart, newSelEnd)
              inputEl.setSelectionRange(finalSelStart, finalSelEnd)
            } else {
              // Segment type/dateKey changed, or it's a fallback to a different segment, so select fully.
              inputEl.setSelectionRange(
                segmentToSelect.start,
                segmentToSelect.end
              )
            }
            activeIdxRef.current = newActiveSegmentIdx
          } else {
            // 4. Ultimate Fallback: No navigable segment found, clear selection or go to start
            inputEl.setSelectionRange(0, 0)
            activeIdxRef.current = -1
          }
        } else {
          segmentsRef.current = newSegments
          setSegmentVersion((v) => v + 1)
        }

        setDateRange({ startDate: newStart, endDate: newEnd })
      }
    },
    [
      inputRef,
      dateRange.startDate,
      dateRange.endDate,
      setDateRange,
      selectSegment,
      onFocusPortalRequested,
      setOpenPortal,
      timeZone
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
    [
      handleKeyDown,
      selectSegment,
      selectFirstSegment,
      dateRange.startDate,
      dateRange.endDate,
      segmentVersion,
      timeZone
    ]
  )
}
