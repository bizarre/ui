import { useCallback, useEffect } from 'react'
import { useControllableState } from '@radix-ui/react-use-controllable-state'

export type DateRange = {
  startDate?: Date
  endDate?: Date
}

type UseTimeSliceStateProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  dateRange?: DateRange
  defaultDateRange?: DateRange
  onDateRangeChange?: (range: DateRange) => void
  isRelative?: boolean
  defaultIsRelative?: boolean
  onIsRelativeChange?: (isRelative: boolean) => void
}

export function useTimeSliceState({
  onDateRangeChange,
  ...props
}: UseTimeSliceStateProps) {
  const [open, setOpen] = useControllableState({
    prop: props.open,
    defaultProp: props.defaultOpen ?? false,
    onChange: props.onOpenChange
  })

  const onDateRangeChangeGuard = useCallback(
    (range: DateRange) => {
      if (range.startDate && range.endDate && range.startDate > range.endDate) {
        onDateRangeChange?.({
          startDate: undefined,
          endDate: undefined
        })
        return
      }

      onDateRangeChange?.(range)
    },
    [onDateRangeChange]
  )

  const { defaultDateRange } = props
  const [dateRange, setDateRange] = useControllableState<DateRange>({
    prop: props.dateRange,
    defaultProp: defaultDateRange ?? {},
    onChange: onDateRangeChangeGuard
  })

  useEffect(() => {
    if (
      defaultDateRange &&
      defaultDateRange.endDate &&
      new Date().getTime() - defaultDateRange.endDate?.getTime() < 1000 * 60
    ) {
      setIsRelative(true)
    }
  }, [])

  const [isRelative, setIsRelative] = useControllableState({
    prop: props.isRelative,
    defaultProp: props.defaultIsRelative ?? false,
    onChange: props.onIsRelativeChange
  })

  return {
    open,
    setOpen,
    dateRange,
    setDateRange,
    isRelative,
    setIsRelative
  }
}
