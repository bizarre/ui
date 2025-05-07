import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'

// Import necessary types and helpers
// Note: Dates are global, specific types like DateSegmentType might be needed if testAdjustment signature requires it implicitly
//       but testAdjustment itself is imported and handles its own types internally now.
import {
  testAdjustment,
  // Import other utils if needed directly by tests here (e.g., getHookFromUtils, createMockKeyboardEvent)
  // For now, only testAdjustment seems directly used by the tests being moved.
  getHook as getHookFromUtils, // Needed for 'Segment Structure Changes' test
  buildSegments, // Needed for 'Segment Structure Changes' test
  createMockKeyboardEvent, // Needed for 'Segment Structure Changes' test
  type Segment // Needed for 'Segment Structure Changes' test
} from '../test-utils'

describe('Date Adjustments', () => {
  // Standard beforeEach/afterEach for timers and global mock clearing
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  // Copied describe block: ArrowUp/ArrowDown date adjustment
  describe('ArrowUp/ArrowDown date adjustment', () => {
    const dateForYearTestStart = new Date('2023-01-15T10:30:00Z')
    const dateForYearTestEnd = new Date('2024-01-15T11:45:00Z')
    const baseStartDate = new Date('2024-01-15T10:30:00Z')
    const baseEndDate = new Date('2024-01-15T11:45:00Z')

    it('ArrowUp on month segment (start date) should increment month', () => {
      testAdjustment(
        'ArrowUp',
        'month',
        'start',
        baseStartDate,
        baseEndDate,
        (d) => d.getMonth(),
        1,
        'UTC'
      )
    })
    it('ArrowDown on day segment (start date) should decrement day', () => {
      testAdjustment(
        'ArrowDown',
        'day',
        'start',
        baseStartDate,
        baseEndDate,
        (d) => d.getDate(),
        1,
        'UTC'
      )
    })
    it('ArrowUp on hour segment (start date) should increment hour', () => {
      testAdjustment(
        'ArrowUp',
        'hour',
        'start',
        baseStartDate,
        baseEndDate,
        (d) => d.getHours(),
        1,
        'UTC'
      )
    })
    it('ArrowDown on minute segment (end date) should decrement minute', () => {
      testAdjustment(
        'ArrowDown',
        'minute',
        'end',
        baseStartDate,
        baseEndDate,
        (d) => d.getMinutes(),
        1,
        'UTC'
      )
    })
    it('ArrowUp on year segment (start date) should increment year', () => {
      testAdjustment(
        'ArrowUp',
        'year',
        'start',
        dateForYearTestStart,
        dateForYearTestEnd,
        (d) => d.getFullYear(),
        1,
        'UTC'
      )
    })
    it('ArrowUp on dayPeriod segment (start date, AM to PM) should flip period', () => {
      testAdjustment(
        'ArrowUp',
        'dayPeriod',
        'start',
        baseStartDate,
        baseEndDate,
        (d) => d.getUTCHours(), // Expected value depends on timezone logic, validated within testAdjustment now
        22, // Adjusted expected value for UTC AM -> PM flip
        'UTC'
      )
    })
    it('ArrowDown on dayPeriod segment (start date, AM to PM) should flip period', () => {
      testAdjustment(
        'ArrowDown',
        'dayPeriod',
        'start',
        baseStartDate,
        baseEndDate,
        (d) => d.getUTCHours(),
        22, // Adjusted expected value for UTC AM -> PM flip
        'UTC'
      )
    })
    it('ArrowUp on dayPeriod segment (start date, PM to AM)', () => {
      const pmStartDate = new Date('2024-01-15T22:30:00Z') // PM in UTC
      testAdjustment(
        'ArrowUp',
        'dayPeriod',
        'start',
        pmStartDate,
        baseEndDate,
        (d) => d.getUTCHours(),
        10, // Adjusted expected value for UTC PM -> AM flip
        'UTC'
      )
    })

    it('ArrowDown on day from March 1st should go to Feb 28th/29th', () => {
      const startDate = new Date('2024-03-01T10:00:00Z')
      const endDate = new Date('2024-03-10T10:00:00Z')
      testAdjustment(
        'ArrowDown',
        'day',
        'start',
        startDate,
        endDate,
        (d) => d.getUTCDate(),
        1,
        'UTC'
      )
    })

    it('ArrowDown on day from March 1st (non-leap) should go to Feb 28th', () => {
      const startDate = new Date('2023-03-01T10:00:00Z')
      const endDate = new Date('2023-03-10T10:00:00Z')
      testAdjustment(
        'ArrowDown',
        'day',
        'start',
        startDate,
        endDate,
        (d) => d.getUTCDate(),
        1,
        'UTC'
      )
    })

    it('ArrowDown on month from Jan 15th should go to Dec 15th of previous year', () => {
      const startDate = new Date('2024-01-15T10:00:00Z')
      const endDate = new Date('2024-02-15T10:00:00Z')
      testAdjustment(
        'ArrowDown',
        'month',
        'start',
        startDate,
        endDate,
        (d) => d.getUTCMonth(),
        1,
        'UTC'
      )
    })

    it('ArrowUp on month from Dec 15th should go to Jan 15th of next year', () => {
      const startDate = new Date('2023-12-15T10:00:00Z')
      const endDate = new Date('2024-01-15T10:00:00Z')
      testAdjustment(
        'ArrowUp',
        'month',
        'start',
        startDate,
        endDate,
        (d) => d.getUTCMonth(),
        1,
        'UTC'
      )
    })

    it('ArrowUp on day from Jan 31st should go to Feb 1st', () => {
      const startDate = new Date('2024-01-31T10:00:00Z')
      const endDate = new Date('2024-02-05T10:00:00Z')
      testAdjustment(
        'ArrowUp',
        'day',
        'start',
        startDate,
        endDate,
        (d) => d.getUTCDate(),
        1,
        'UTC'
      )
    })
  })

  // Copied describe block: Segment Structure Changes During Adjustment
  describe('Segment Structure Changes During Adjustment', () => {
    it('should handle fallback selection if target segment index is invalid after date adjustment causes segment list to change structure', () => {
      const startDate = new Date('2023-12-31T23:58:00Z')
      const endDate = new Date('2023-12-31T23:59:00Z')
      const timeZone = 'UTC'

      // This test needs getHookFromUtils directly
      const { result, mockInputRef, mockSetDateRange } = getHookFromUtils(
        { startDate, endDate },
        buildSegments(startDate, endDate, timeZone).text, // buildSegments is imported
        timeZone
      )

      let minuteSegmentIdx = -1
      let minuteSegmentValue = ''
      for (let i = 0; i < result.current.segments.length; i++) {
        if (
          result.current.segments[i].type === 'minute' &&
          result.current.segments[i].dateKey === 'end'
        ) {
          minuteSegmentIdx = i
          minuteSegmentValue = result.current.segments[i].value
          break
        }
      }
      expect(minuteSegmentIdx).not.toBe(-1)
      expect(minuteSegmentValue).toBe('59')

      act(() => {
        result.current.selectSegment(minuteSegmentIdx)
      })
      mockInputRef.current!.setSelectionRange.mockClear()
      mockSetDateRange.mockClear()

      const preventDefaultFn = vi.fn()
      // createMockKeyboardEvent is imported
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowUp',
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockSetDateRange).toHaveBeenCalledTimes(1)
      const newDateRange = mockSetDateRange.mock.calls[0][0]
      expect(newDateRange.endDate?.getUTCFullYear()).toBe(2024)
      expect(newDateRange.endDate?.getUTCMonth()).toBe(0)
      expect(newDateRange.endDate?.getUTCDate()).toBe(1)
      expect(newDateRange.endDate?.getUTCHours()).toBe(0)
      expect(newDateRange.endDate?.getUTCMinutes()).toBe(0)

      expect(mockInputRef.current!.setSelectionRange).toHaveBeenCalled()

      const lastCallArgs =
        mockInputRef.current!.setSelectionRange.mock.calls.pop()
      expect(lastCallArgs).toBeDefined()
      if (lastCallArgs) {
        const [selStart, selEnd] = lastCallArgs
        expect(selEnd! >= selStart!).toBe(true)

        let newMinuteSegmentSelected = false
        const newSegments = buildSegments(
          newDateRange.startDate!,
          newDateRange.endDate!,
          timeZone
        ).segments
        for (const seg of newSegments) {
          if (
            seg.type === 'minute' &&
            seg.dateKey === 'end' &&
            seg.value === '00'
          ) {
            if (seg.start === selStart && seg.end === selEnd) {
              newMinuteSegmentSelected = true
              break
            }
          }
        }
        let firstNavigableSelected = false
        const firstNavigableNew = newSegments.find(
          (s: Segment) => s.type !== 'literal'
        ) // Segment is imported
        if (
          firstNavigableNew &&
          firstNavigableNew.start === selStart &&
          firstNavigableNew.end === selEnd
        ) {
          firstNavigableSelected = true
        }

        expect(newMinuteSegmentSelected || firstNavigableSelected).toBe(true)
      }
    })
  })
})
