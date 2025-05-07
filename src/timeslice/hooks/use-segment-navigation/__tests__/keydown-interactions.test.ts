import { act } from '@testing-library/react'
import { vi } from 'vitest'
import {
  // useSegmentNavigation, // Not directly used in these tests
  buildSegments, // Used by one test in ArrowDown suite
  // type DateSegmentType, // Not used
  type Segment // Used in Tab suite helper
} from '../use-segment-navigation'
// import type { DateRange } from '../../use-time-slice-state'; // Not used
import {
  createMockKeyboardEvent,
  getHook as getHookFromUtils
} from '../test-utils'

describe('useSegmentNavigation: KeyDown Interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  // Copied from use-segment-navigation.test.ts
  const baseStartDate = new Date('2024-01-15T10:30:00Z')
  const baseEndDate = new Date('2024-01-15T11:45:00Z')
  const timeZone = 'UTC'

  it('Enter: should call setOpenPortal(false) and blur input', () => {
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
        dateRange: { startDate: baseStartDate, endDate: baseEndDate },
        setDateRange: mockSetDateRange,
        timeZone,
        onFocusPortalRequested: mockOnFocusPortalRequested,
        setOpenPortal: mockSetOpenPortal
      })
    })
    const preventDefaultFn = vi.fn()
    const mockEvent = createMockKeyboardEvent({
      key: 'Enter',
      preventDefault: preventDefaultFn
    })
    act(() => {
      result.current.handleKeyDown(mockEvent)
    })
    expect(mockEvent.preventDefault).toHaveBeenCalled()
    expect(mockSetOpenPortal).toHaveBeenCalledWith(false)
    expect(mockInputRef.current?.blur).toHaveBeenCalled()
  })

  describe('ArrowDown to focus portal', () => {
    it('should call onFocusPortalRequested if no dates are set', () => {
      const { result, mockOnFocusPortalRequested } = getHookFromUtils()
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowDown',
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockOnFocusPortalRequested).toHaveBeenCalled()
    })

    it('should call onFocusPortalRequested if input is empty (and dates are set)', () => {
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
          dateRange: { startDate: baseStartDate, endDate: baseEndDate },
          setDateRange: mockSetDateRange,
          timeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })
      mockInputRef.current!.value = ''
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowDown',
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockOnFocusPortalRequested).toHaveBeenCalled()
    })

    it('should call onFocusPortalRequested if input is fully selected (and dates are set)', () => {
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
          dateRange: { startDate: baseStartDate, endDate: baseEndDate },
          setDateRange: mockSetDateRange,
          timeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })
      const inputValue = buildSegments(baseStartDate, baseEndDate, 'UTC').text
      mockInputRef.current!.value = inputValue
      mockInputRef.current!.selectionStart = 0
      mockInputRef.current!.selectionEnd = inputValue.length
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowDown',
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockOnFocusPortalRequested).toHaveBeenCalled()
    })
  })

  describe('Tab to focus portal or navigate segments', () => {
    it('Tab: should call onFocusPortalRequested if no dates are set', () => {
      const { result, mockOnFocusPortalRequested } = getHookFromUtils()
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: false,
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockOnFocusPortalRequested).toHaveBeenCalled()
    })

    it('Tab: should call onFocusPortalRequested if input value differs from canonical (and dates are set)', () => {
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
          dateRange: { startDate: baseStartDate, endDate: baseEndDate },
          setDateRange: mockSetDateRange,
          timeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })
      mockInputRef.current!.value = 'Something different'
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: false,
        preventDefault: preventDefaultFn
      })
      act(() => {
        result.current.handleKeyDown(mockEvent)
      })
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockOnFocusPortalRequested).toHaveBeenCalled()
    })

    const setupTabSegmentNavigation = () => {
      const hookUtils = getHookFromUtils()
      const {
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = hookUtils
      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate: baseStartDate, endDate: baseEndDate },
          setDateRange: mockSetDateRange,
          timeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })
      const { text: canonicalText, segments: builtSegments } = buildSegments(
        baseStartDate,
        baseEndDate,
        'UTC'
      )
      mockInputRef.current!.value = canonicalText

      const startSegs = builtSegments.filter(
        (s: Segment) => s.dateKey === 'start' && s.type !== 'literal'
      )
      const endSegs = builtSegments.filter(
        (s: Segment) => s.dateKey === 'end' && s.type !== 'literal'
      )
      const startBlock = {
        start: Math.min(...startSegs.map((s: Segment) => s.start)),
        end: Math.max(...startSegs.map((s: Segment) => s.end))
      }
      const endBlock = {
        start: Math.min(...endSegs.map((s: Segment) => s.start)),
        end: Math.max(...endSegs.map((s: Segment) => s.end))
      }
      return { ...hookUtils, startBlock, endBlock, canonicalText }
    }

    it('Tab: from start date block to end date block', () => {
      const { result, startBlock, endBlock, mockInputRef } =
        setupTabSegmentNavigation()
      mockInputRef.current!.selectionStart = startBlock.start
      mockInputRef.current!.selectionEnd = startBlock.end
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: false,
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        endBlock.start,
        endBlock.end
      )
    })

    it('Tab: from end date block to start date block (cycles)', () => {
      const { result, startBlock, endBlock, mockInputRef } =
        setupTabSegmentNavigation()
      mockInputRef.current!.selectionStart = endBlock.start
      mockInputRef.current!.selectionEnd = endBlock.end
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: false,
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        startBlock.start,
        startBlock.end
      )
    })

    it('Shift+Tab: from end date block to start date block', () => {
      const { result, startBlock, endBlock, mockInputRef } =
        setupTabSegmentNavigation()
      mockInputRef.current!.selectionStart = endBlock.start
      mockInputRef.current!.selectionEnd = endBlock.end
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: true,
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        startBlock.start,
        startBlock.end
      )
    })

    it('Shift+Tab: from start date block to end date block (cycles)', () => {
      const { result, startBlock, endBlock, mockInputRef } =
        setupTabSegmentNavigation()
      mockInputRef.current!.selectionStart = startBlock.start
      mockInputRef.current!.selectionEnd = startBlock.end
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'Tab',
        shiftKey: true,
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        endBlock.start,
        endBlock.end
      )
    })
  })
})
