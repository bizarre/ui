import Timezone from 'timezone-enum'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import type { Scope } from '@radix-ui/react-context'
import { DismissableLayer } from '@radix-ui/react-dismissable-layer'
import { Slot } from '@radix-ui/react-slot'
import { sub, formatDistanceStrict } from 'date-fns'
import React, { useCallback, useMemo } from 'react'
import { useTimeSliceState, type DateRange } from './hooks/use-time-slice-state'
import {
  useSegmentNavigation,
  buildSegments
} from './hooks/use-segment-navigation'
import { parseDateInput } from './utils/date-parser'

export type TimeZone = keyof typeof Timezone

const COMPONENT_NAME = 'TimeSlice'

type ScopedProps<P> = P & { __scope?: Scope }
const [createTimeSliceContext] = createContextScope(COMPONENT_NAME)

type TimeSliceContextValue = {
  timeZone: TimeZone
  inputRef: React.RefObject<HTMLInputElement | null>
  open: boolean
  setOpen: (open: boolean) => void
  onOpenChange?: (open: boolean) => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  formatInputValue: (args: {
    startDate?: Date
    endDate?: Date
    isRelative: boolean
  }) => string
  isRelative: boolean
  setIsRelative: (isRelative: boolean) => void
}

const [TimeSliceProvider, useTimeSliceContext] =
  createTimeSliceContext<TimeSliceContextValue>(COMPONENT_NAME)

type TimeSliceProps = ScopedProps<{
  children: React.ReactNode
  timeZone?: TimeZone
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  setOpen?: (open: boolean) => void
  formatInput?: (args: {
    startDate?: Date
    endDate?: Date
    isRelative: boolean
  }) => string
  dateRange?: DateRange
  defaultDateRange?: DateRange
  onDateRangeChange?: (range: DateRange) => void
  isRelative?: boolean
  defaultIsRelative?: boolean
  onIsRelativeChange?: (isRelative: boolean) => void
}>

const TimeSlice: React.FC<TimeSliceProps> = ({
  children,
  __scope,
  formatInput: formatInputProp,
  timeZone = 'UTC',
  ...stateProps
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const {
    open,
    setOpen,
    dateRange,
    setDateRange: setDateRangeInternal,
    isRelative,
    setIsRelative
  } = useTimeSliceState(stateProps)

  const setDateRange = useCallback(
    (range: DateRange) => {
      setDateRangeInternal(range)
      if (
        range.endDate &&
        new Date().getTime() - range.endDate.getTime() < 1000 * 60
      ) {
        if (range.endDate.getTime() - new Date().getTime() > 1000 * 60) {
          setIsRelative(false)
        } else {
          setIsRelative(true)
        }
      } else {
        setIsRelative(false)
      }
    },
    [setDateRangeInternal, setIsRelative]
  )

  const defaultFormatInput = useCallback(
    ({
      startDate,
      endDate,
      isRelative
    }: {
      startDate?: Date
      endDate?: Date
      isRelative: boolean
    }): string => {
      if (!startDate || !endDate) return ''
      if (isRelative && endDate > startDate) {
        const human = formatDistanceStrict(startDate, endDate, {
          roundingMethod: 'floor'
        })
        return `Past ${human}`
      } else {
        return buildSegments(startDate, endDate).text
      }
    },
    []
  )

  const formatInputValue = useMemo(
    () => formatInputProp || defaultFormatInput,
    [formatInputProp, defaultFormatInput]
  )

  React.useEffect(() => {
    if (inputRef.current && !open) {
      inputRef.current.value = formatInputValue({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        isRelative: isRelative
      })
    }
  }, [dateRange, isRelative, formatInputValue, open])

  const close = useCallback(() => {
    if (open) {
      setOpen(false)
      if (inputRef.current && dateRange.startDate && dateRange.endDate) {
        inputRef.current.value = formatInputValue({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          isRelative: isRelative
        })
      }
    }
  }, [open, setOpen, inputRef, dateRange, formatInputValue, isRelative])

  return (
    <DismissableLayer onEscapeKeyDown={close} onPointerDownOutside={close}>
      <TimeSliceProvider
        scope={__scope}
        timeZone={timeZone}
        inputRef={inputRef}
        open={open}
        setOpen={setOpen}
        dateRange={dateRange}
        setDateRange={setDateRange}
        isRelative={isRelative}
        setIsRelative={setIsRelative}
        formatInputValue={formatInputValue}
      >
        <div style={{ position: 'relative' }}>{children}</div>
      </TimeSliceProvider>
    </DismissableLayer>
  )
}

type TimeSliceTriggerProps = ScopedProps<{
  children: React.ReactNode
  asChild?: boolean
}> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>

const TimeSliceTrigger = React.forwardRef<
  HTMLDivElement,
  TimeSliceTriggerProps
>(({ asChild, children, __scope, ...props }, forwardedRef) => {
  const { inputRef } = useTimeSliceContext(COMPONENT_NAME, __scope)

  const onClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [inputRef])

  const Comp = asChild ? Slot : 'div'

  return (
    <Comp {...props} onClick={onClick} ref={forwardedRef}>
      {children}
    </Comp>
  )
})

type TimeSliceInputProps = ScopedProps<{
  children?: React.ReactNode
  asChild?: boolean
}> &
  Omit<
    React.HTMLAttributes<HTMLInputElement>,
    'onChange' | 'onKeyDown' | 'onFocus' | 'onClick'
  >

const TimeSliceInput = React.forwardRef<HTMLInputElement, TimeSliceInputProps>(
  ({ asChild, children, __scope, ...props }, forwardedRef) => {
    const context = useTimeSliceContext(COMPONENT_NAME, __scope)
    const internalInputRef = React.useRef<HTMLInputElement>(null)
    const composedInputRef = composeRefs(
      forwardedRef,
      context.inputRef,
      internalInputRef
    )

    const { handleKeyDown } = useSegmentNavigation({
      inputRef: context.inputRef,
      dateRange: context.dateRange,
      setDateRange: context.setDateRange
    })

    const {
      inputRef: contextInputRef,
      dateRange,
      formatInputValue,
      isRelative,
      open,
      setOpen,
      setDateRange
    } = context

    React.useEffect(() => {
      const inputEl = contextInputRef.current
      if (inputEl && document.activeElement !== inputEl) {
        if (dateRange.startDate && dateRange.endDate) {
          inputEl.value = buildSegments(
            dateRange.startDate,
            dateRange.endDate
          ).text
        } else {
          inputEl.value = formatInputValue({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            isRelative: isRelative
          })
        }
      }
    }, [contextInputRef, dateRange, formatInputValue, isRelative])

    const handleFocus = useCallback(() => {
      if (!open) {
        setOpen(true)
      }

      const inputEl = contextInputRef.current
      if (inputEl && dateRange.startDate && dateRange.endDate) {
        const { text } = buildSegments(dateRange.startDate, dateRange.endDate)
        inputEl.value = text
        queueMicrotask(() => {
          setTimeout(() => {
            inputEl.select()
          }, 0)
        })
      }
    }, [open, setOpen, contextInputRef, dateRange])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        const { startDate, endDate } = parseDateInput(value)

        if (startDate && endDate) {
          setDateRange({ startDate, endDate })
        } else if (!value) {
          setDateRange({ startDate: undefined, endDate: undefined })
        }
      },
      [setDateRange]
    )

    const inputProps = {
      ...props,
      ref: composedInputRef,
      value: undefined,
      defaultValue: context.formatInputValue({
        startDate: context.dateRange.startDate,
        endDate: context.dateRange.endDate,
        isRelative: context.isRelative
      }),
      onFocus: handleFocus,
      onChange: handleChange,
      onKeyDown: handleKeyDown
    }

    const Comp = asChild ? Slot : 'input'

    return (
      <Comp {...inputProps} ref={composedInputRef}>
        {children}
      </Comp>
    )
  }
)

type TimeSlicePortalProps = ScopedProps<{
  children: React.ReactNode
  asChild?: boolean
}> &
  React.HTMLAttributes<HTMLDivElement>

const TimeSlicePortal = React.forwardRef<HTMLDivElement, TimeSlicePortalProps>(
  ({ asChild, children, __scope, ...props }, forwardedRef) => {
    const context = useTimeSliceContext(COMPONENT_NAME, __scope)
    if (!context.open) return null

    const portalProps = {
      ...props,
      ref: forwardedRef,
      style: {
        position: 'absolute' as const,
        width: '100%',
        zIndex: 10,
        ...props.style
      }
    }

    const Comp = asChild ? Slot : 'div'

    return <Comp {...portalProps}>{children}</Comp>
  }
)

type TimeSliceShortcutProps = ScopedProps<{
  children: React.ReactNode
  duration: Partial<{
    years: number
    months: number
    days: number
    hours: number
    minutes: number
    seconds: number
  }>
  asChild?: boolean
}> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>

const TimeSliceShortcut = React.forwardRef<
  HTMLDivElement,
  TimeSliceShortcutProps
>(({ asChild, children, __scope, duration, ...props }, forwardedRef) => {
  const { setIsRelative, setDateRange, setOpen } = useTimeSliceContext(
    COMPONENT_NAME,
    __scope
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const now = new Date()
      const startDate = sub(now, duration)
      const endDate = now

      setIsRelative(true)
      setDateRange({ startDate, endDate })
      setOpen(false)
    },
    [setIsRelative, setDateRange, setOpen, duration]
  )

  const optionProps = {
    ...props,
    ref: forwardedRef,
    onClick: handleClick,
    style: { cursor: 'pointer', ...props.style }
  }

  const Comp = asChild ? Slot : 'div'

  return <Comp {...optionProps}>{children}</Comp>
})

const Root = TimeSlice
const Trigger = TimeSliceTrigger
const Input = TimeSliceInput
const Portal = TimeSlicePortal
const Shortcut = TimeSliceShortcut

export {
  Root,
  Trigger,
  Input,
  Portal,
  Shortcut,
  type TimeSliceProps,
  type TimeSliceInputProps,
  type TimeSlicePortalProps,
  type TimeSliceShortcutProps,
  type DateRange
}
