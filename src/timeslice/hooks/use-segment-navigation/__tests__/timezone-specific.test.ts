import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { buildSegments } from '../use-segment-navigation'
import { getHook as getHookFromUtils, testAdjustment } from '../test-utils'

describe('useSegmentNavigation: Timezone specific behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('(America/New_York)', () => {
    const nyTimeZone = 'America/New_York'

    it('should build segments correctly for America/New_York', () => {
      const startDateNY = new Date('2024-01-15T10:30:00Z')
      const endDateNY = new Date('2024-01-15T14:45:00Z')

      const {
        result,
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = getHookFromUtils({}, '', nyTimeZone)

      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate: startDateNY, endDate: endDateNY },
          setDateRange: mockSetDateRange,
          timeZone: nyTimeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const builtSegmentsResult = buildSegments(
        startDateNY,
        endDateNY,
        nyTimeZone
      )

      const normalizeText = (text: string) => text.replace(/\s/g, ' ')
      expect(normalizeText(builtSegmentsResult.text)).toBe(
        normalizeText('Jan 15, 5:30 AM – Jan 15, 9:45 AM')
      )
      expect(result.current.segments).toEqual(builtSegmentsResult.segments)
    })

    it('ArrowUp on dayPeriod segment (start date, AM to PM) should flip period correctly in America/New_York', () => {
      const startDateInNY_AM = new Date('2024-01-15T10:30:00Z')
      const endDateInNY = new Date('2024-01-15T20:00:00Z')

      testAdjustment(
        'ArrowUp',
        'dayPeriod',
        'start',
        startDateInNY_AM,
        endDateInNY,
        (d) =>
          parseInt(
            new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              hour12: false,
              timeZone: nyTimeZone
            }).format(d),
            10
          ),
        17, // 10 AM UTC is 5 AM NY. 5 AM + 12 hours = 5 PM (17:00)
        nyTimeZone
      )
    })

    it('ArrowUp on dayPeriod segment (start date, PM to AM) should flip period correctly in America/New_York', () => {
      const startDateInNY_PM = new Date('2024-01-15T22:30:00Z') // 10:30 PM UTC is 5:30 PM NY
      const endDateInNY = new Date('2024-01-16T05:00:00Z')

      testAdjustment(
        'ArrowUp',
        'dayPeriod',
        'start',
        startDateInNY_PM,
        endDateInNY,
        (d) =>
          parseInt(
            new Intl.DateTimeFormat('en-US', {
              hour: 'numeric',
              hour12: false,
              timeZone: nyTimeZone
            }).format(d),
            10
          ),
        5, // 5 PM NY (17:00) + 12 hours (flip) = 5 AM NY (05:00) the next day implicitly
        nyTimeZone
      )
    })
  })
})
