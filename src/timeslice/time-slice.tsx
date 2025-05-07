import Timezone from 'timezone-enum'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import type { Scope } from '@radix-ui/react-context'
import { DismissableLayer } from '@radix-ui/react-dismissable-layer'
import { Slot } from '@radix-ui/react-slot'
import { sub, formatDistanceStrict } from 'date-fns'
import React, { useCallback, useMemo, useId } from 'react'
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
  focusPortal?: () => void
  portalContentRef?: React.RefObject<HTMLDivElement | null>
  inputId?: string
  portalId?: string
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
  onDateRangeConfirm?: (range: DateRange) => void
  isRelative?: boolean
  defaultIsRelative?: boolean
  onIsRelativeChange?: (isRelative: boolean) => void
  onIsRelativeConfirm?: (isRelative: boolean) => void
}>

const TimeSlice: React.FC<TimeSliceProps> = ({
  children,
  __scope,
  formatInput: formatInputProp,
  timeZone = 'UTC',
  ...stateProps
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const portalContentRef = React.useRef<HTMLDivElement>(null)
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

  const focusPortal = useCallback(() => {
    if (portalContentRef.current) {
      const firstFocusable = portalContentRef.current.querySelector(
        '[data-shortcut-item="true"]:not([disabled])'
      ) as HTMLElement | null
      if (firstFocusable) {
        firstFocusable.focus()
      }
    }
  }, [])

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

  const uniqueId = useId()
  const inputId = `${uniqueId}-input`
  const portalId = `${uniqueId}-portal`

  // Effect to call onDateRangeConfirm/onIsRelativeConfirm when the portal closes
  const prevOpenRef = React.useRef(open)
  const onDateRangeConfirmProp = stateProps.onDateRangeConfirm
  const onIsRelativeConfirmProp = stateProps.onIsRelativeConfirm

  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      // Portal transitioned from open to closed
      if (onDateRangeConfirmProp && dateRange.startDate && dateRange.endDate) {
        onDateRangeConfirmProp(dateRange)
      }
      if (onIsRelativeConfirmProp) {
        onIsRelativeConfirmProp(isRelative)
      }
    }
    prevOpenRef.current = open
  }, [
    open,
    dateRange,
    isRelative,
    onDateRangeConfirmProp,
    onIsRelativeConfirmProp
  ])

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
        focusPortal={focusPortal}
        portalContentRef={portalContentRef}
        inputId={inputId}
        portalId={portalId}
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
      setDateRange: context.setDateRange,
      onFocusPortalRequested: context.focusPortal,
      setOpenPortal: context.setOpen
    })

    const {
      inputRef: contextInputRef,
      dateRange,
      formatInputValue,
      isRelative,
      open: isOpen,
      setOpen,
      setDateRange,
      inputId: contextInputId,
      portalId: contextPortalId
    } = context

    React.useEffect(() => {
      const inputEl = contextInputRef.current
      if (inputEl && document.activeElement !== inputEl && !isOpen) {
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
    }, [contextInputRef, dateRange, formatInputValue, isRelative, isOpen])

    const handleFocus = useCallback(() => {
      const wasOpen = isOpen
      if (!wasOpen) {
        setOpen(true)
      }

      const inputEl = contextInputRef.current
      if (inputEl) {
        if (dateRange.startDate && dateRange.endDate) {
          const canonicalText = buildSegments(
            dateRange.startDate,
            dateRange.endDate
          ).text

          if (wasOpen && inputEl.value !== canonicalText) {
          } else {
            inputEl.value = canonicalText
          }
        }

        queueMicrotask(() => {
          setTimeout(() => {
            if (document.activeElement === inputEl) {
              inputEl.select()
            }
          }, 0)
        })
      }
    }, [isOpen, setOpen, contextInputRef, dateRange])

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

    const inputPropsAria = {
      ...props,
      id: contextInputId,
      role: 'combobox',
      'aria-haspopup': 'listbox' as const,
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? contextPortalId : undefined,
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
      <Comp {...inputPropsAria} ref={composedInputRef}>
        {children}
      </Comp>
    )
  }
)

type TimeSlicePortalProps = ScopedProps<{
  children: React.ReactNode
  asChild?: boolean
  ariaLabel?: string
}> &
  React.HTMLAttributes<HTMLDivElement>

const TimeSlicePortal = React.forwardRef<HTMLDivElement, TimeSlicePortalProps>(
  ({ asChild, children, __scope, ariaLabel, ...props }, forwardedRef) => {
    const context = useTimeSliceContext(COMPONENT_NAME, __scope)
    if (!context.open) return null

    const handleKeyDownInPortal = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!context.portalContentRef?.current) return

        const items = Array.from(
          context.portalContentRef.current.querySelectorAll(
            '[data-shortcut-item="true"]:not([disabled])'
          )
        ) as HTMLElement[]

        if (items.length === 0) return

        const currentFocusedElement = document.activeElement as HTMLElement
        const currentIndex = items.findIndex(
          (item) => item === currentFocusedElement
        )

        if (e.key === 'Escape') {
          e.preventDefault()
          context.setOpen(false)
          context.inputRef.current?.focus()
          return
        }

        if (e.key === 'Enter' && currentIndex !== -1) {
          e.preventDefault()
          items[currentIndex].click()
          return
        }

        let nextIndex = currentIndex

        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault()
          if (e.key === 'Tab' && currentIndex === items.length - 1) {
            context.inputRef.current?.focus()
            context.inputRef.current?.select()
            return
          }
          nextIndex =
            currentIndex === -1 ? 0 : (currentIndex + 1) % items.length
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault()
          if (e.key === 'Tab' && e.shiftKey && currentIndex === 0) {
            context.inputRef.current?.focus()
            context.inputRef.current?.select()
            return
          }
          nextIndex =
            currentIndex === -1
              ? items.length - 1
              : (currentIndex - 1 + items.length) % items.length
        }

        if (nextIndex !== currentIndex && items[nextIndex]) {
          items[nextIndex].focus()
        }
      },
      [context.portalContentRef, context.setOpen, context.inputRef]
    )

    const portalPropsAria = {
      ...props,
      id: context.portalId,
      role: 'listbox',
      'aria-label': ariaLabel,
      ref: composeRefs(forwardedRef, context.portalContentRef),
      onKeyDown: handleKeyDownInPortal,
      style: {
        position: 'absolute' as const,
        width: '100%',
        zIndex: 10,
        ...props.style
      }
    }

    const Comp = asChild ? Slot : 'div'

    return <Comp {...portalPropsAria}>{children}</Comp>
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
  const { setIsRelative, setDateRange, setOpen, inputRef } =
    useTimeSliceContext(COMPONENT_NAME, __scope)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const now = new Date()
      const startDate = sub(now, duration)
      const endDate = now

      setIsRelative(true)
      setDateRange({ startDate, endDate })
      setOpen(false)
      if (inputRef.current) {
        inputRef.current.blur()
      }
    },
    [setIsRelative, setDateRange, setOpen, duration, inputRef]
  )

  const optionPropsAria = {
    ...props,
    role: 'option',
    'aria-selected': false,
    ref: forwardedRef,
    onClick: handleClick,
    tabIndex: -1,
    'data-shortcut-item': 'true',
    style: { cursor: 'pointer', ...props.style }
  }

  const Comp = asChild ? Slot : 'div'

  return <Comp {...optionPropsAria}>{children}</Comp>
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
