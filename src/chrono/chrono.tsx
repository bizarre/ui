import Timezone from 'timezone-enum'
import { createContextScope } from '@radix-ui/react-context'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { DismissableLayer } from '@radix-ui/react-dismissable-layer'
import { Slot } from '@radix-ui/react-slot'
import { sub, add, Duration } from 'date-fns'
import React, { useCallback, useMemo, useId, useState, useEffect } from 'react'
import { useChronoState, type DateRange } from './hooks/use-chrono-state'
import {
  useSegmentNavigation,
  buildSegments
} from './hooks/use-segment-navigation/use-segment-navigation'
import { parseDateInput } from './utils/date-parser'
import { formatTimeRange } from './utils/time-range'
import { ScopedProps } from '../types'

export type TimeZone = keyof typeof Timezone

const COMPONENT_NAME = 'Chrono'

const [createChronoContext] = createContextScope(COMPONENT_NAME)

type ChronoContextValue = {
  timeZone: TimeZone
  inputRef: React.RefObject<HTMLInputElement | null>
  open: boolean
  setOpen: (open: boolean) => void
  onOpenChange?: (open: boolean) => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  setInternalIsRelative: (isRelative: boolean) => void
  formatInputValue: (args: {
    startDate?: Date
    endDate?: Date
    isRelative: boolean
  }) => string
  internalIsRelative: boolean
  focusPortal?: () => void
  portalContentRef?: React.RefObject<HTMLDivElement | null>
  inputId?: string
  portalId?: string
}

const [ChronoProvider, useChronoContext] =
  createChronoContext<ChronoContextValue>(COMPONENT_NAME)

type ChronoProps = ScopedProps<{
  children: React.ReactNode
  timeZone?: TimeZone
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  setOpen?: (open: boolean) => void
  formatInput?:
    | ((args: {
        startDate?: Date
        endDate?: Date
        isRelative: boolean
      }) => string)
    | null
  dateRange?: DateRange
  defaultDateRange?: DateRange
  onDateRangeChange?: (range: DateRange) => void
  onDateRangeConfirm?: (range: DateRange) => void
}>

const Chrono: React.FC<ChronoProps> = ({
  children,
  __scope,
  formatInput: formatInputProp,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onDateRangeConfirm: onDateRangeConfirmProp,
  ...stateProps
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const portalContentRef = React.useRef<HTMLDivElement>(null)
  const {
    open,
    setOpen,
    dateRange,
    setDateRange: setDateRangeInternal
  } = useChronoState(stateProps)

  const calculateIsRelative = useCallback((range: DateRange): boolean => {
    let shouldBeRelative = false
    const nowMs = new Date().getTime()
    const THRESHOLD_MS = 5000

    if (range.endDate) {
      const endDateMs = range.endDate.getTime()
      if (
        endDateMs > nowMs - THRESHOLD_MS &&
        endDateMs <= nowMs + THRESHOLD_MS
      ) {
        shouldBeRelative = true
      }
    }

    if (!shouldBeRelative && range.startDate && range.endDate) {
      const startDateMs = range.startDate.getTime()
      const endDateMs = range.endDate.getTime()

      if (Math.abs(startDateMs - nowMs) <= THRESHOLD_MS && endDateMs > nowMs) {
        shouldBeRelative = true
      }
    }

    return shouldBeRelative
  }, [])

  const [internalIsRelative, setInternalIsRelative] = useState<boolean>(() =>
    calculateIsRelative(
      stateProps.dateRange ?? stateProps.defaultDateRange ?? {}
    )
  )

  const setDateRange = useCallback(
    (range: DateRange) => {
      setDateRangeInternal(range)
      setInternalIsRelative(calculateIsRelative(range))
    },
    [setDateRangeInternal, calculateIsRelative]
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
    }) =>
      formatTimeRange({
        start: startDate,
        end: endDate,
        relative: isRelative,
        timeZone
      }),
    [timeZone]
  )

  const formatInputValue = useMemo(() => {
    if (formatInputProp) {
      return formatInputProp
    }

    if (formatInputProp === null) {
      return (args: {
        startDate?: Date
        endDate?: Date
        isRelative: boolean
      }) => {
        if (!args.startDate || !args.endDate) return ''
        return buildSegments(args.startDate, args.endDate, timeZone).text
      }
    }

    return defaultFormatInput
  }, [formatInputProp, defaultFormatInput])

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

  useEffect(() => {
    const inputEl = inputRef.current
    if (inputEl && !open) {
      inputEl.value = formatInputValue({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        isRelative: internalIsRelative
      })
    }
  }, [dateRange, internalIsRelative, formatInputValue, open, timeZone])

  const close = useCallback(() => {
    if (open) {
      setOpen(false)
      if (inputRef.current && dateRange.startDate && dateRange.endDate) {
        inputRef.current.value = formatInputValue({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          isRelative: internalIsRelative
        })
      }
    }
  }, [open, setOpen, inputRef, dateRange, formatInputValue, internalIsRelative])

  const uniqueId = useId()
  const inputId = `${uniqueId}-input`
  const portalId = `${uniqueId}-portal`

  const prevOpenRef = React.useRef(open)

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      if (onDateRangeConfirmProp && dateRange.startDate && dateRange.endDate) {
        onDateRangeConfirmProp(dateRange)
      }
    }
    prevOpenRef.current = open
  }, [open, dateRange, onDateRangeConfirmProp])

  return (
    <DismissableLayer onEscapeKeyDown={close} onPointerDownOutside={close}>
      <ChronoProvider
        scope={__scope}
        timeZone={timeZone as TimeZone}
        inputRef={inputRef}
        open={open}
        setOpen={setOpen}
        dateRange={dateRange}
        setDateRange={setDateRange}
        internalIsRelative={internalIsRelative}
        setInternalIsRelative={setInternalIsRelative}
        formatInputValue={formatInputValue}
        focusPortal={focusPortal}
        portalContentRef={portalContentRef}
        inputId={inputId}
        portalId={portalId}
      >
        <div style={{ position: 'relative' }}>{children}</div>
      </ChronoProvider>
    </DismissableLayer>
  )
}

type ChronoTriggerProps = ScopedProps<{
  children: React.ReactNode
  asChild?: boolean
}> &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>

const ChronoTrigger = React.forwardRef<HTMLDivElement, ChronoTriggerProps>(
  ({ asChild, children, __scope, ...props }, forwardedRef) => {
    const { inputRef } = useChronoContext(COMPONENT_NAME, __scope)

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
  }
)

type ChronoInputProps = ScopedProps<{
  children?: React.ReactNode
  asChild?: boolean
}> &
  Omit<
    React.HTMLAttributes<HTMLInputElement>,
    'onChange' | 'onKeyDown' | 'onFocus' | 'onClick'
  >

const ChronoInput = React.forwardRef<HTMLInputElement, ChronoInputProps>(
  ({ asChild, children, __scope, ...props }, forwardedRef) => {
    const context = useChronoContext(COMPONENT_NAME, __scope)
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
      timeZone: context.timeZone,
      onFocusPortalRequested: context.focusPortal,
      setOpenPortal: context.setOpen
    })

    const {
      inputRef: contextInputRef,
      dateRange,
      formatInputValue,
      internalIsRelative,
      open: isOpen,
      setOpen,
      setDateRange,
      inputId: contextInputId,
      portalId: contextPortalId
    } = context

    React.useEffect(() => {
      const inputEl = contextInputRef.current
      if (inputEl && document.activeElement !== inputEl && !isOpen) {
        inputEl.value = formatInputValue({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          isRelative: internalIsRelative
        })
      }
    }, [
      contextInputRef,
      dateRange,
      formatInputValue,
      internalIsRelative,
      isOpen,
      context.timeZone
    ])

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
            dateRange.endDate,
            context.timeZone
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
    }, [isOpen, setOpen, contextInputRef, dateRange, context.timeZone])

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
        isRelative: context.internalIsRelative
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

type ChronoPortalProps = ScopedProps<{
  children: React.ReactNode
  asChild?: boolean
  ariaLabel?: string
}> &
  React.HTMLAttributes<HTMLDivElement>

const ChronoPortal = React.forwardRef<HTMLDivElement, ChronoPortalProps>(
  ({ asChild, children, __scope, ariaLabel, ...props }, forwardedRef) => {
    const context = useChronoContext(COMPONENT_NAME, __scope)

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
        display: context.open ? undefined : 'none',
        ...props.style
      }
    }

    const Comp = asChild ? Slot : 'div'

    return <Comp {...portalPropsAria}>{children}</Comp>
  }
)

type ChronoShortcutProps = ScopedProps<{
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

const ChronoShortcut = React.forwardRef<HTMLDivElement, ChronoShortcutProps>(
  ({ asChild, children, __scope, duration, ...props }, forwardedRef) => {
    const { setDateRange, setInternalIsRelative, setOpen, inputRef } =
      useChronoContext(COMPONENT_NAME, __scope)

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        const now = new Date()
        let finalStartDate: Date
        let finalEndDate: Date

        const isFutureIntent = Object.values(duration).some(
          (val) => val !== undefined && val < 0
        )

        const normalizedDuration: Duration = {}
        ;(Object.keys(duration) as Array<keyof typeof duration>).forEach(
          (key) => {
            const value = duration[key]
            if (value !== undefined) {
              normalizedDuration[key] = Math.abs(value)
            }
          }
        )

        if (isFutureIntent) {
          finalStartDate = now
          finalEndDate = add(now, normalizedDuration)
        } else {
          finalStartDate = sub(now, normalizedDuration)
          finalEndDate = now
        }

        setInternalIsRelative(true)
        setDateRange({ startDate: finalStartDate, endDate: finalEndDate })
        setOpen(false)
        if (inputRef.current) {
          inputRef.current.blur()
        }
      },
      [setDateRange, setInternalIsRelative, setOpen, duration, inputRef]
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
  }
)

const Root = Chrono
const Trigger = ChronoTrigger
const Input = ChronoInput
const Portal = ChronoPortal
const Shortcut = ChronoShortcut

export {
  Root,
  Trigger,
  Input,
  Portal,
  Shortcut,
  type ChronoProps,
  type ChronoInputProps,
  type ChronoPortalProps,
  type ChronoShortcutProps,
  type DateRange
}
