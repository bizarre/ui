import React from 'react'
import { TimeSlice } from '@lib'
import type { DateRange } from '@lib/timeslice'

export default function TimeSliceExample() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    startDate: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    endDate: new Date()
  })

  const onDateRangeChange = (range: DateRange) => {
    setDateRange(range)
  }

  const getDurationLabel = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) return `${years}y`
    if (months > 0) return `${months}mo`
    if (weeks > 0) return `${weeks}w`
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`

    return `${seconds}s`
  }

  const activeDurationLabel = React.useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return '-'
    return getDurationLabel(
      dateRange.endDate.getTime() - dateRange.startDate.getTime()
    )
  }, [dateRange])

  return (
    <TimeSlice.Root
      onDateRangeChange={onDateRangeChange}
      defaultDateRange={dateRange}
    >
      <TimeSlice.Trigger asChild>
        <div className="flex items-center border border-zinc-700 rounded-sm p-1.5 w-[280px] hover:border-zinc-600 cursor-pointer">
          <div className="h-[20px] w-[42px] bg-zinc-800 rounded-sm text-xs text-center leading-[20px] mr-2 text-zinc-300">
            {activeDurationLabel}
          </div>
          <TimeSlice.Input className="bg-transparent text-sm text-zinc-300 w-full outline-none border-none cursor-pointer" />
        </div>
      </TimeSlice.Trigger>
      <TimeSlice.Portal className="w-[280px] bg-zinc-900 border border-zinc-700 rounded-sm mt-1 p-2 flex flex-col gap-1.5 text-sm">
        <TimeSlice.Shortcut duration={{ minutes: 15 }} asChild>
          <div className="hover:bg-zinc-800 p-1.5 rounded-sm text-zinc-300 cursor-pointer">
            15 minutes
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-1.5 rounded-sm text-zinc-300 cursor-pointer">
            1 hour
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-1.5 rounded-sm text-zinc-300 cursor-pointer">
            1 day
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-1.5 rounded-sm text-zinc-300 cursor-pointer">
            1 month
          </div>
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}
