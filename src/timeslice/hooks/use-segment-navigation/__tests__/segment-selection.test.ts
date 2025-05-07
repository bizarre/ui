import { act } from '@testing-library/react'
import { vi } from 'vitest'
// import type { Segment } from '../../use-segment-navigation'; // Changed
import {
  getHook as getHookFromUtils,
  type Segment // Now importing Segment type from test utils
} from '../test-utils'

describe('useSegmentNavigation: Segment Selection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const startDate = new Date('2024-01-15T10:30:00Z')
  const endDate = new Date('2024-01-15T11:45:00Z')
  const timeZone = 'UTC'

  it('selectSegment: should select a navigable segment and update input selection', () => {
    const {
      result,
      rerender,
      mockInputRef,
      mockSetDateRange,
      mockOnFocusPortalRequested,
      mockSetOpenPortal
    } = getHookFromUtils()
    act(() => {
      rerender({
        inputRef: mockInputRef,
        dateRange: { startDate, endDate },
        setDateRange: mockSetDateRange,
        timeZone,
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })
    const firstNavigableSegmentIndex = result.current.segments.findIndex(
      (s: Segment) => s.type !== 'literal'
    )
    expect(firstNavigableSegmentIndex).toBeGreaterThanOrEqual(0)
    const segmentToSelect = result.current.segments[firstNavigableSegmentIndex]
    act(() => {
      result.current.selectSegment(firstNavigableSegmentIndex)
    })
    expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
      segmentToSelect.start,
      segmentToSelect.end
    )
  })

  it('should not include literal-type segments in its internal, navigable segment list', () => {
    const {
      result,
      rerender,
      mockInputRef,
      mockSetDateRange,
      mockOnFocusPortalRequested,
      mockSetOpenPortal
    } = getHookFromUtils()
    act(() => {
      rerender({
        inputRef: mockInputRef,
        dateRange: { startDate, endDate },
        setDateRange: mockSetDateRange,
        timeZone,
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })

    const hasLiteralSegment = result.current.segments.some(
      (s: Segment) => s.type === 'literal'
    )
    expect(
      hasLiteralSegment,
      "The hook's internal segment list should not contain literal-type segments."
    ).toBe(false)
  })

  it('selectFirstSegment: should select the first navigable segment', () => {
    const {
      result,
      rerender,
      mockInputRef,
      mockSetDateRange,
      mockOnFocusPortalRequested,
      mockSetOpenPortal
    } = getHookFromUtils()
    act(() => {
      rerender({
        inputRef: mockInputRef,
        dateRange: { startDate, endDate },
        setDateRange: mockSetDateRange,
        timeZone,
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })
    const firstNavigableSegment = result.current.segments.find(
      (s: Segment) => s.type !== 'literal'
    )
    expect(firstNavigableSegment).toBeDefined()
    act(() => {
      result.current.selectFirstSegment()
    })
    expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
      firstNavigableSegment!.start,
      firstNavigableSegment!.end
    )
  })
})
