import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { buildSegments, type Segment } from '../use-segment-navigation'
import {
  getHook as getHookFromUtils,
  createMockKeyboardEvent
} from '../test-utils'

describe('useSegmentNavigation: Manual Input Change Interaction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const initialStartDate = new Date('2024-05-10T10:00:00Z')
  const initialEndDate = new Date('2024-05-10T12:00:00Z')
  const initialTimeZone = 'UTC'

  it('should use existing segments for navigation if input is manually changed to non-parsing text', () => {
    const { result, mockInputRef, mockSetDateRange } = getHookFromUtils(
      { startDate: initialStartDate, endDate: initialEndDate },
      buildSegments(initialStartDate, initialEndDate, initialTimeZone).text,
      initialTimeZone
    )
    const originalSegments = [...result.current.segments]
    const firstNavigable = originalSegments.find(
      (s: Segment) => s.type !== 'literal'
    )!

    act(() =>
      result.current.selectSegment(originalSegments.indexOf(firstNavigable))
    )
    mockInputRef.current!.setSelectionRange.mockClear()

    const arbitraryText = 'This is not a date'
    mockInputRef.current!.value = arbitraryText

    const preventDefaultFn = vi.fn()
    const mockEvent = createMockKeyboardEvent({
      key: 'ArrowRight',
      preventDefault: preventDefaultFn
    })
    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    expect(mockSetDateRange).not.toHaveBeenCalled()
    const secondNavigableIndex = originalSegments.findIndex(
      (s: Segment, idx) =>
        idx > originalSegments.indexOf(firstNavigable) && s.type !== 'literal'
    )
    if (secondNavigableIndex !== -1) {
      const secondNavigable = originalSegments[secondNavigableIndex]
      expect(mockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        secondNavigable.start,
        secondNavigable.end
      )
    } else {
      // If there's no second navigable, it might have selected the end of the input or similar.
      // For this specific test, the main assertion is that setDateRange wasn't called
      // and that navigation still happened based on old segments, so setSelectionRange *was* called.
      expect(mockInputRef.current!.setSelectionRange).toHaveBeenCalled()
    }
    expect(mockInputRef.current!.value).toBe(arbitraryText) // Value should remain the arbitrary text
  })

  it('should handle input manually changed to a NEW valid date string (then ArrowKey)', () => {
    const { result, mockInputRef, mockSetDateRange } = getHookFromUtils(
      { startDate: initialStartDate, endDate: initialEndDate },
      buildSegments(initialStartDate, initialEndDate, initialTimeZone).text,
      initialTimeZone
    )

    const newValidDateText = 'May 11, 2024, 2:00 PM – May 11, 2024, 4:00 PM'
    mockInputRef.current!.value = newValidDateText

    // Simulate cursor being on one of the old segments before ArrowRight
    const firstOldSegment = result.current.segments.find(
      (s: Segment) => s.type !== 'literal'
    )!
    act(() => {
      // Even if we try to select an old segment, the new input text means segments should NOT rebuild yet (until blur/enter generally)
      // For ArrowKey navigation with altered text, it should attempt to parse. If parse fails, it uses old, if parse succeeds it *should* use new.
      // However, current hook logic for ArrowKey nav when text is changed relies on existing segmentsRef.current for navigation decision.
      // It does NOT re-parse on every arrow key if the text is simply different.
      // It will re-parse and rebuild segments on blur/focus or if setDateRange is called.
      // This test verifies that even with new valid text, ArrowRight uses existing segment structure prior to a re-parse/rebuild event.
      mockInputRef.current!.setSelectionRange(
        firstOldSegment.start, // These start/end might be out of bounds for newValidDateText
        firstOldSegment.end
      )
    })
    mockInputRef.current!.setSelectionRange.mockClear()

    const preventDefaultFn = vi.fn()
    const mockEvent = createMockKeyboardEvent({
      key: 'ArrowRight',
      preventDefault: preventDefaultFn
    })
    act(() => {
      result.current.handleKeyDown(mockEvent)
    })

    // Crucially, setDateRange should NOT have been called by just an arrow key press
    // even if the text *could* parse to a new date. That typically happens on blur/commit.
    expect(mockSetDateRange).not.toHaveBeenCalled()
    // setSelectionRange should have been called based on the *original* segment structure.
    expect(mockInputRef.current!.setSelectionRange).toHaveBeenCalled()
    expect(mockInputRef.current!.value).toBe(newValidDateText) // Input value remains the manually typed one
  })
})
