import { act } from '@testing-library/react'
import { vi } from 'vitest'
import {
  // useSegmentNavigation, // Not used
  buildSegments
  // type Segment // Not used
} from '../use-segment-navigation'
// import type { DateRange } from '../../use-chrono-state' // Not used
import {
  // createMockInputRef,
  getHook as getHookFromUtils
  // createMockKeyboardEvent, // Not used in these tests
  // testAdjustment // Not used in these tests
} from '../test-utils'

describe('useSegmentNavigation: Initial State and Segment Building', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('should initialize with no segments if no dates are provided', () => {
    const { result } = getHookFromUtils()
    expect(result.current.segments).toEqual([])
  })

  it('should initialize with no segments if one date is missing', () => {
    const startDate = new Date('2024-01-15T10:00:00Z')
    const { result } = getHookFromUtils({ startDate, endDate: undefined })
    expect(result.current.segments).toEqual([])
  })

  it('should build segments when valid startDate and endDate are provided and update on rerender', () => {
    const startDate1 = new Date('2023-01-15T10:30:00Z')
    const endDate1 = new Date('2024-02-20T14:45:00Z')
    const {
      result,
      rerender,
      mockInputRef,
      mockSetDateRange,
      mockOnFocusPortalRequested,
      mockSetOpenPortal
    } = getHookFromUtils()

    const directBuildOutput1 = buildSegments(startDate1, endDate1, 'UTC')

    act(() => {
      rerender({
        inputRef: mockInputRef,
        dateRange: { startDate: startDate1, endDate: endDate1 },
        setDateRange: mockSetDateRange,
        timeZone: 'UTC',
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })

    expect(result.current.segments.length).toBe(
      directBuildOutput1.segments.length
    )
    expect(result.current.segments).toEqual(
      expect.arrayContaining(directBuildOutput1.segments)
    )

    const startDate2 = new Date('2025-03-10T08:00:00Z')
    const endDate2 = new Date('2025-03-10T17:15:00Z')
    const directBuildOutput2 = buildSegments(startDate2, endDate2, 'UTC')

    act(() => {
      rerender({
        inputRef: mockInputRef,
        dateRange: { startDate: startDate2, endDate: endDate2 },
        setDateRange: mockSetDateRange,
        timeZone: 'UTC',
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })

    expect(result.current.segments.length).toBe(
      directBuildOutput2.segments.length
    )
    expect(result.current.segments).toEqual(
      expect.arrayContaining(directBuildOutput2.segments)
    )
  })
})
