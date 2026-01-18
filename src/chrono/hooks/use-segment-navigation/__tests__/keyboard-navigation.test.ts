import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  createMockKeyboardEvent,
  getHook as getHookFromUtils,
  buildSegments,
  type Segment
} from '../test-utils'

describe('Keyboard Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('ArrowLeft/ArrowRight segment navigation', () => {
    let hookUtils: ReturnType<typeof getHookFromUtils>
    let localHookResult: ReturnType<typeof getHookFromUtils>['result']
    let localMockInputRef: ReturnType<typeof getHookFromUtils>['mockInputRef']
    let localSegments: Segment[]
    let firstNavigable: Segment
    let secondNavigable: Segment
    let lastNavigable: Segment

    const localBaseStartDate = new Date('2024-01-15T10:30:00Z')
    const localBaseEndDate = new Date('2024-01-15T11:45:00Z')
    const localTimeZone = 'UTC'

    beforeEach(() => {
      hookUtils = getHookFromUtils()
      localHookResult = hookUtils.result
      localMockInputRef = hookUtils.mockInputRef
      const {
        rerender,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = hookUtils

      act(() => {
        rerender({
          inputRef: localMockInputRef,
          dateRange: {
            startDate: localBaseStartDate,
            endDate: localBaseEndDate
          },
          setDateRange: mockSetDateRange,
          timeZone: localTimeZone,
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const built = buildSegments(
        localBaseStartDate,
        localBaseEndDate,
        localTimeZone
      )
      localSegments = built.segments
      localMockInputRef.current!.value = built.text

      const navigable = localSegments.filter(
        (s: Segment) => s.type !== 'literal'
      )
      if (navigable.length < 2) {
        throw new Error(
          'Test setup for ArrowLeft/Right navigation requires at least 2 navigable segments.'
        )
      }
      firstNavigable = navigable[0]
      secondNavigable = navigable[1]
      lastNavigable = navigable[navigable.length - 1]
      localMockInputRef.current!.setSelectionRange.mockClear()
    })

    it('ArrowRight: from one segment to the next', () => {
      localMockInputRef.current!.selectionStart = firstNavigable.start
      localMockInputRef.current!.selectionEnd = firstNavigable.end
      act(() => {
        localHookResult.current.selectSegment(
          localSegments.indexOf(firstNavigable)
        )
      })
      localMockInputRef.current!.setSelectionRange.mockClear()
      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowRight',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        secondNavigable.start,
        secondNavigable.end
      )
    })

    it('ArrowLeft: from one segment to the previous', () => {
      localMockInputRef.current!.selectionStart = secondNavigable.start
      localMockInputRef.current!.selectionEnd = secondNavigable.end
      act(() => {
        localHookResult.current.selectSegment(
          localSegments.indexOf(secondNavigable)
        )
      })
      localMockInputRef.current!.setSelectionRange.mockClear()

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowLeft',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        firstNavigable.start,
        firstNavigable.end
      )
    })

    it('ArrowRight: at the last segment, should place cursor at end of input', () => {
      localMockInputRef.current!.selectionStart = lastNavigable.start
      localMockInputRef.current!.selectionEnd = lastNavigable.end
      act(() => {
        localHookResult.current.selectSegment(
          localSegments.indexOf(lastNavigable)
        )
      })
      localMockInputRef.current!.setSelectionRange.mockClear()

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowRight',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        localMockInputRef.current!.value.length,
        localMockInputRef.current!.value.length
      )
    })

    it('ArrowLeft: at the first segment, should place cursor at start of input', () => {
      localMockInputRef.current!.selectionStart = firstNavigable.start
      localMockInputRef.current!.selectionEnd = firstNavigable.end
      act(() => {
        localHookResult.current.selectSegment(
          localSegments.indexOf(firstNavigable)
        )
      })
      localMockInputRef.current!.setSelectionRange.mockClear()

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowLeft',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        0,
        0
      )
    })

    it('ArrowRight: when input is fully selected, should place cursor at end of input', () => {
      localMockInputRef.current!.selectionStart = 0
      localMockInputRef.current!.selectionEnd =
        localMockInputRef.current!.value.length

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowRight',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        localMockInputRef.current!.value.length,
        localMockInputRef.current!.value.length
      )
    })

    it('ArrowLeft: when input is fully selected, should place cursor at start of input', () => {
      localMockInputRef.current!.selectionStart = 0
      localMockInputRef.current!.selectionEnd =
        localMockInputRef.current!.value.length

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowLeft',
        preventDefault: preventDefaultFn
      })
      act(() => localHookResult.current.handleKeyDown(mockEvent))

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(localMockInputRef.current!.setSelectionRange).toHaveBeenCalledWith(
        0,
        0
      )
    })
  })

  describe('Keyboard Navigation: Cursor within segment (partial selection)', () => {
    const startDate = new Date('2024-03-15T10:30:00Z')
    const endDate = new Date('2024-03-15T12:45:00Z')
    const timeZone = 'UTC' // This timeZone is local to this describe block

    it('ArrowUp: when cursor is in middle of day segment, should adjust day', () => {
      const {
        result,
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = getHookFromUtils(
        { startDate, endDate },
        buildSegments(startDate, endDate, timeZone).text,
        timeZone
      )
      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate, endDate },
          setDateRange: mockSetDateRange,
          timeZone, // Uses the local timeZone
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const daySegment = result.current.segments.find(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )
      expect(daySegment).toBeDefined()
      if (!daySegment) return

      const cursorPositionInSegment = 1
      const originalSelectionStart = daySegment.start + cursorPositionInSegment
      mockInputRef.current!.selectionStart = originalSelectionStart
      mockInputRef.current!.selectionEnd = originalSelectionStart

      const targetIdx = result.current.segments.findIndex(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowUp',
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))

      expect(preventDefaultFn).toHaveBeenCalled()
      expect(mockSetDateRange).toHaveBeenCalledTimes(1)
      const newDateRange = mockSetDateRange.mock.calls[0][0]
      expect(newDateRange.startDate?.getUTCDate()).toBe(16)
      expect(newDateRange.endDate?.toISOString()).toBe(endDate.toISOString())

      const newSegments = result.current.segments
      const newDaySegment = newSegments[targetIdx]

      expect(newDaySegment).toBeDefined()
      expect(newDaySegment.type).toBe('day')
      expect(newDaySegment.value).toBe('16')

      const expectedNewSelectionStart =
        newDaySegment.start + cursorPositionInSegment
      expect(mockInputRef.current?.selectionStart).toBe(
        expectedNewSelectionStart
      )
      expect(mockInputRef.current?.selectionEnd).toBe(expectedNewSelectionStart)
    })

    it('ArrowDown: when cursor is in middle of day segment, should adjust day', () => {
      const {
        result,
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = getHookFromUtils(
        { startDate, endDate },
        buildSegments(startDate, endDate, timeZone).text,
        timeZone
      )
      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate, endDate },
          setDateRange: mockSetDateRange,
          timeZone, // Uses the local timeZone
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const daySegment = result.current.segments.find(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )
      expect(daySegment).toBeDefined()
      if (!daySegment) return

      const cursorPositionInSegment = 1
      const originalSelectionStart = daySegment.start + cursorPositionInSegment
      mockInputRef.current!.selectionStart = originalSelectionStart
      mockInputRef.current!.selectionEnd = originalSelectionStart

      const targetIdx = result.current.segments.findIndex(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowDown',
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))

      expect(preventDefaultFn).toHaveBeenCalled()
      expect(mockSetDateRange).toHaveBeenCalledTimes(1)
      const newDateRange = mockSetDateRange.mock.calls[0][0]
      expect(newDateRange.startDate?.getUTCDate()).toBe(14)
      expect(newDateRange.endDate?.toISOString()).toBe(endDate.toISOString())

      const newSegments = result.current.segments
      const newDaySegment = newSegments[targetIdx]
      expect(newDaySegment).toBeDefined()
      expect(newDaySegment.type).toBe('day')
      expect(newDaySegment.value).toBe('14')

      const expectedNewSelectionStart =
        newDaySegment.start + cursorPositionInSegment
      expect(mockInputRef.current?.selectionStart).toBe(
        expectedNewSelectionStart
      )
      expect(mockInputRef.current?.selectionEnd).toBe(expectedNewSelectionStart)
    })

    it('ArrowRight: when cursor is in middle of day segment, should select next navigable segment (hour)', () => {
      const {
        result,
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = getHookFromUtils(
        { startDate, endDate },
        buildSegments(startDate, endDate, timeZone).text,
        timeZone
      )
      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate, endDate },
          setDateRange: mockSetDateRange,
          timeZone, // Uses the local timeZone
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const daySegment = result.current.segments.find(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )
      expect(daySegment).toBeDefined()
      if (!daySegment) return

      const cursorPositionInSegment = 1
      mockInputRef.current!.selectionStart =
        daySegment.start + cursorPositionInSegment
      mockInputRef.current!.selectionEnd =
        daySegment.start + cursorPositionInSegment
      mockInputRef.current!.setSelectionRange.mockClear()

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowRight',
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))

      expect(preventDefaultFn).toHaveBeenCalled()
      expect(mockSetDateRange).not.toHaveBeenCalled()

      const hourSegment = result.current.segments.find(
        (s: Segment) => s.type === 'hour' && s.dateKey === 'start'
      )
      expect(hourSegment).toBeDefined()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        hourSegment!.start,
        hourSegment!.end
      )
    })

    it('ArrowLeft: when cursor is in middle of day segment, should select previous navigable segment (month)', () => {
      const {
        result,
        rerender,
        mockInputRef,
        mockSetDateRange,
        mockOnFocusPortalRequested,
        mockSetOpenPortal
      } = getHookFromUtils(
        { startDate, endDate },
        buildSegments(startDate, endDate, timeZone).text,
        timeZone
      )
      act(() => {
        rerender({
          inputRef: mockInputRef,
          dateRange: { startDate, endDate },
          setDateRange: mockSetDateRange,
          timeZone, // Uses the local timeZone
          onFocusPortalRequested: mockOnFocusPortalRequested,
          setOpenPortal: mockSetOpenPortal
        })
      })

      const daySegment = result.current.segments.find(
        (s: Segment) => s.type === 'day' && s.dateKey === 'start'
      )
      expect(daySegment).toBeDefined()
      if (!daySegment) return

      const cursorPositionInSegment = 1
      mockInputRef.current!.selectionStart =
        daySegment.start + cursorPositionInSegment
      mockInputRef.current!.selectionEnd =
        daySegment.start + cursorPositionInSegment
      mockInputRef.current!.setSelectionRange.mockClear()

      const preventDefaultFn = vi.fn()
      const mockEvent = createMockKeyboardEvent({
        key: 'ArrowLeft',
        preventDefault: preventDefaultFn
      })
      act(() => result.current.handleKeyDown(mockEvent))

      expect(preventDefaultFn).toHaveBeenCalled()
      expect(mockSetDateRange).not.toHaveBeenCalled()

      const monthSegment = result.current.segments.find(
        (s: Segment) => s.type === 'month' && s.dateKey === 'start'
      )
      expect(monthSegment).toBeDefined()
      expect(mockInputRef.current?.setSelectionRange).toHaveBeenCalledWith(
        monthSegment!.start,
        monthSegment!.end
      )
    })
  })
})
