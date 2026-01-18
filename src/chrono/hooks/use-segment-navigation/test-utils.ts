import { vi, type MockedFunction } from 'vitest'
import type React from 'react'
import { renderHook } from '@testing-library/react'
import { useSegmentNavigation } from './use-segment-navigation'
import type { DateRange } from '../use-chrono-state'
import { act } from '@testing-library/react'
import {
  buildSegments as buildSegmentsInternal,
  type DateSegmentType as DateSegmentTypeInternal
} from './use-segment-navigation'
import type { Segment as SegmentInternal } from './use-segment-navigation'

// Re-export for use in test files
export { buildSegmentsInternal as buildSegments }
export type {
  SegmentInternal as Segment,
  DateSegmentTypeInternal as DateSegmentType
}

export type MockedHTMLInputElement = Omit<
  HTMLInputElement,
  'setSelectionRange' | 'blur' | 'focus'
> & {
  setSelectionRange: MockedFunction<HTMLInputElement['setSelectionRange']>
  blur: MockedFunction<HTMLInputElement['blur']>
  focus: MockedFunction<HTMLInputElement['focus']>
}

export const createMockInputRef = (initialValue = '') => {
  const el = document.createElement('input')
  el.value = initialValue

  let currentSelectionStart: number | null = 0
  let currentSelectionEnd: number | null = 0

  Object.defineProperty(el, 'selectionStart', {
    get: () => currentSelectionStart,
    set: (val: number | null) => (currentSelectionStart = val),
    configurable: true
  })
  Object.defineProperty(el, 'selectionEnd', {
    get: () => currentSelectionEnd,
    set: (val: number | null) => (currentSelectionEnd = val),
    configurable: true
  })

  el.setSelectionRange = vi.fn((start: number | null, end: number | null) => {
    currentSelectionStart = start
    currentSelectionEnd = end
  }) as MockedFunction<HTMLInputElement['setSelectionRange']>

  el.blur = vi.fn() as MockedFunction<HTMLInputElement['blur']>
  el.focus = vi.fn() as MockedFunction<HTMLInputElement['focus']>

  return { current: el as MockedHTMLInputElement }
}

export type MockKeyboardEventInit = {
  key: string
  code?: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  preventDefault?: MockedFunction<() => void>
  stopPropagation?: MockedFunction<() => void>
  target?: EventTarget | undefined
}

export const createMockKeyboardEvent = (
  init: MockKeyboardEventInit
): React.KeyboardEvent<HTMLInputElement> => {
  const preventDefaultFn = init.preventDefault ?? vi.fn()
  const stopPropagationFn = init.stopPropagation ?? vi.fn()

  return {
    key: init.key,
    code: init.code ?? init.key,
    altKey: init.altKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    preventDefault: preventDefaultFn,
    stopPropagation: stopPropagationFn,
    isDefaultPrevented: () => preventDefaultFn.mock.calls.length > 0,
    isPropagationStopped: () => stopPropagationFn.mock.calls.length > 0,
    target: init.target === undefined ? ({} as EventTarget) : init.target,
    currentTarget: {} as HTMLInputElement,
    bubbles: false,
    cancelable: false,
    defaultPrevented: preventDefaultFn.mock.calls.length > 0,
    eventPhase: 0,
    isTrusted: false,
    nativeEvent: new KeyboardEvent(init.key, init) as Event,
    timeStamp: Date.now(),
    type: 'keydown',
    getModifierState: vi.fn(() => false),
    repeat: false,
    location: 0,
    which: 0,
    keyCode: 0,
    char: init.key.length === 1 ? init.key : '',
    charCode: init.key.length === 1 ? init.key.charCodeAt(0) : 0,
    locale: '',
    detail: 0,
    view: null,
    persist: vi.fn(),
    DOM_KEY_LOCATION_STANDARD: 0,
    DOM_KEY_LOCATION_LEFT: 1,
    DOM_KEY_LOCATION_RIGHT: 2,
    DOM_KEY_LOCATION_NUMPAD: 3
  } as unknown as React.KeyboardEvent<HTMLInputElement>
}

export const getHook = (
  initialDateRange: DateRange = {},
  initialInputValue = '',
  timeZone = 'UTC'
) => {
  const mockInputRef = createMockInputRef(initialInputValue)
  const mockSetDateRange: MockedFunction<(range: DateRange) => void> = vi.fn()
  const mockOnFocusPortalRequested: MockedFunction<() => void> = vi.fn()
  const mockSetOpenPortal: MockedFunction<(open: boolean) => void> = vi.fn()

  const initialProps = {
    inputRef: mockInputRef,
    dateRange: initialDateRange,
    setDateRange: mockSetDateRange,
    timeZone,
    onFocusPortalRequested: mockOnFocusPortalRequested,
    setOpenPortal: mockSetOpenPortal
  }
  const hookRender = renderHook((props) => useSegmentNavigation(props), {
    initialProps
  })

  return {
    ...hookRender,
    mockInputRef,
    mockSetDateRange,
    mockOnFocusPortalRequested,
    mockSetOpenPortal
  }
}

export const setupForAdjustment = (
  startDate: Date,
  endDate: Date,
  segmentToSelectType: string,
  dateKeyToSelect: 'start' | 'end',
  timeZone = 'UTC'
) => {
  const initialText = buildSegmentsInternal(startDate, endDate, timeZone).text
  const hookUtilsPayload = getHook({}, initialText, timeZone)
  const {
    result,
    rerender,
    mockInputRef,
    mockSetDateRange,
    mockOnFocusPortalRequested,
    mockSetOpenPortal
  } = hookUtilsPayload

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
  const targetSegmentIndex = result.current.segments.findIndex(
    (s: SegmentInternal) =>
      s.type === segmentToSelectType && s.dateKey === dateKeyToSelect
  )
  if (targetSegmentIndex === -1) {
    throw new Error(
      `Segment ${segmentToSelectType} for ${dateKeyToSelect} date not found. Text: "${initialText}", Segments: ${JSON.stringify(result.current.segments, null, 2)}`
    )
  }
  act(() => result.current.selectSegment(targetSegmentIndex))
  return hookUtilsPayload
}

export const testAdjustment = (
  key: 'ArrowUp' | 'ArrowDown',
  segmentType: DateSegmentTypeInternal,
  dateKey: 'start' | 'end',
  originalStartDate: Date,
  originalEndDate: Date,
  expectedDateAccessor: (date: Date) => number,
  expectedRawDelta: number,
  timeZone = 'UTC'
) => {
  const setupUtils = setupForAdjustment(
    originalStartDate,
    originalEndDate,
    segmentType,
    dateKey,
    timeZone
  )
  if (
    !setupUtils ||
    !setupUtils.mockSetDateRange ||
    !setupUtils.mockInputRef ||
    !setupUtils.result
  ) {
    throw new Error(
      `testAdjustment Error: setupForAdjustment did not return expected utils/mocks for key='${key}', segmentType='${segmentType}', dateKey='${dateKey}'.`
    )
  }
  const { result: hookResultRef, mockSetDateRange, mockInputRef } = setupUtils

  const preventDefaultFn = vi.fn()
  const mockEvent = createMockKeyboardEvent({
    key,
    preventDefault: preventDefaultFn
  })
  act(() => hookResultRef.current.handleKeyDown(mockEvent))

  expect(mockEvent.preventDefault).toHaveBeenCalled()

  if (mockSetDateRange.mock.calls.length === 0) {
    throw new Error(
      `testAdjustment Error: setDateRange was not called for key='${key}', segmentType='${segmentType}', dateKey='${dateKey}'. Original dates: ${originalStartDate.toISOString()} / ${originalEndDate.toISOString()}`
    )
  }

  expect(mockSetDateRange).toHaveBeenCalledTimes(1)

  const newDateRange = mockSetDateRange.mock.calls[0][0]
  const changedDate =
    dateKey === 'start' ? newDateRange.startDate : newDateRange.endDate
  const originalDate = dateKey === 'start' ? originalStartDate : originalEndDate

  expect(changedDate).toBeDefined()
  if (segmentType === 'dayPeriod') {
    const newHourInTimezone = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone
      }).format(changedDate!),
      10
    )
    expect(newHourInTimezone).toBe(expectedRawDelta)
  } else if (segmentType === 'month' || segmentType === 'day') {
    expect(changedDate!.getTime()).not.toBe(originalDate.getTime())
  } else {
    const appliedDelta =
      key === 'ArrowUp' ? expectedRawDelta : -expectedRawDelta
    expect(expectedDateAccessor(changedDate!)).toBe(
      expectedDateAccessor(originalDate) + appliedDelta
    )
  }
  if (dateKey === 'start') {
    expect(newDateRange.endDate?.toISOString()).toBe(
      originalEndDate.toISOString()
    )
  } else {
    expect(newDateRange.startDate?.toISOString()).toBe(
      originalStartDate.toISOString()
    )
  }
  const expectedNewText = buildSegmentsInternal(
    newDateRange.startDate!,
    newDateRange.endDate!,
    timeZone
  ).text
  expect(mockInputRef.current!.value).toBe(expectedNewText)
}
