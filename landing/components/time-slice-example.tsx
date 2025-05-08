import React from 'react'
import { TimeSlice } from '@lib'
import type { DateRange } from '@lib/timeslice'
import { ChevronDown } from 'lucide-react'

export default function TimeSliceExample() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    startDate: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    endDate: new Date()
  })
  const [isOpen, setIsOpen] = React.useState(false)

  const onDateRangeChange = (range: DateRange) => {
    setDateRange(range)
  }

  const getDurationLabel = (start: Date, end: Date) => {
    const ms = end.getTime() - start.getTime()

    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day
    const month = 30.44 * day
    const year = 365.25 * day

    if (ms >= year) return `${Math.floor(ms / year)}y`
    if (ms >= month) return `${Math.floor(ms / month)}mo`
    if (ms >= week) return `${Math.floor(ms / week)}w`
    if (ms >= day) return `${Math.floor(ms / day)}d`
    if (ms >= hour) return `${Math.floor(ms / hour)}h`
    if (ms >= minute) return `${Math.floor(ms / minute)}m`

    return `${Math.floor(ms / 1000)}s`
  }

  const activeDurationLabel = React.useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return '-'
    return getDurationLabel(dateRange.startDate, dateRange.endDate)
  }, [dateRange])

  return (
    <TimeSlice.Root
      onDateRangeChange={onDateRangeChange}
      defaultDateRange={dateRange}
      onOpenChange={setIsOpen}
    >
      <TimeSlice.Trigger asChild>
        <div className="flex items-center space-x-2 w-full">
          <div className="flex-1 flex items-center border border-zinc-800/80 hover:border-zinc-700 bg-zinc-900/60 backdrop-blur-sm rounded-md px-3 py-2 transition-all duration-200 cursor-pointer group">
            <div className="flex items-center space-x-2 w-full">
              <div className="h-[22px] min-w-[44px] bg-zinc-800/80 border border-zinc-700/50 rounded-md text-xs text-center leading-[22px] mr-2 text-zinc-300 transition-colors group-hover:border-zinc-700 group-hover:bg-zinc-800">
                {activeDurationLabel}
              </div>
              <TimeSlice.Input className="bg-transparent text-sm text-zinc-300 w-full outline-none border-none cursor-pointer overflow-hidden truncate" />
              <div
                className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </TimeSlice.Trigger>

      <TimeSlice.Portal className="relative backdrop-blur-md bg-zinc-900/95 border border-zinc-800/80 rounded-md mt-1.5 p-1.5 flex flex-col gap-1 text-sm shadow-xl z-50 w-full transition-all duration-100 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
        <div className="pb-1.5 px-1.5 mb-1 border-b border-zinc-800/50">
          <div className="text-xs text-zinc-400 font-medium">Quick select</div>
        </div>
        <TimeSlice.Shortcut duration={{ minutes: 15 }} asChild>
          <div className="hover:bg-zinc-800 active:bg-zinc-800/80 focus:bg-zinc-800 p-2 rounded-sm text-zinc-300 cursor-pointer transition-colors duration-150 flex items-center justify-between">
            <span>15 minutes</span>
            <span className="text-xs text-zinc-500">15m</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }} asChild>
          <div className="hover:bg-zinc-800 active:bg-zinc-800/80 focus:bg-zinc-800 p-2 rounded-sm text-zinc-300 cursor-pointer transition-colors duration-150 flex items-center justify-between">
            <span>1 hour</span>
            <span className="text-xs text-zinc-500">1h</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }} asChild>
          <div className="hover:bg-zinc-800 active:bg-zinc-800/80 focus:bg-zinc-800 p-2 rounded-sm text-zinc-300 cursor-pointer transition-colors duration-150 flex items-center justify-between">
            <span>1 day</span>
            <span className="text-xs text-zinc-500">1d</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }} asChild>
          <div className="hover:bg-zinc-800 active:bg-zinc-800/80 focus:bg-zinc-800 p-2 rounded-sm text-zinc-300 cursor-pointer transition-colors duration-150 flex items-center justify-between">
            <span>1 month</span>
            <span className="text-xs text-zinc-500">1mo</span>
          </div>
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}
