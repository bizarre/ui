// Basic usage example for TimeSlice
export const timeSliceBasicExample = `import { TimeSlice } from "@bizarre/ui"

export function TimeRangePicker() {
  const handleDateRangeChange = (range) => {
    console.log('Date range changed:', range)
  }

  return (
    <TimeSlice.Root onDateRangeChange={handleDateRangeChange}>
      <TimeSlice.Input />
      <TimeSlice.Portal>
        <TimeSlice.Shortcut duration={{ minutes: 15 }}>
          15 minutes
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }}>
          1 hour
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }}>
          1 day
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }}>
          1 month
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}`

// Implementation example for TimeSlice - similar to the actual implementation but simplified
export const timeSliceImplementationExample = `import React from 'react'
import { TimeSlice } from '@bizarre/ui'
import { ChevronDown } from 'lucide-react'

export function CustomTimeRangePicker() {
  const [dateRange, setDateRange] = React.useState({
    startDate: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    endDate: new Date()
  })
  const [isOpen, setIsOpen] = React.useState(false)

  // Helper function to format duration as a readable label
  const getDurationLabel = (start, end) => {
    const ms = end.getTime() - start.getTime()
    
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day
    const month = 30.44 * day
    const year = 365.25 * day
    
    if (ms >= year) return \`\${Math.floor(ms / year)}y\`
    if (ms >= month) return \`\${Math.floor(ms / month)}mo\`
    if (ms >= week) return \`\${Math.floor(ms / week)}w\`
    if (ms >= day) return \`\${Math.floor(ms / day)}d\`
    if (ms >= hour) return \`\${Math.floor(ms / hour)}h\`
    if (ms >= minute) return \`\${Math.floor(ms / minute)}m\`
    
    return \`\${Math.floor(ms / 1000)}s\`
  }

  // Calculate the active duration label
  const activeDurationLabel = React.useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return '-'
    return getDurationLabel(dateRange.startDate, dateRange.endDate)
  }, [dateRange])

  return (
    <TimeSlice.Root
      onDateRangeChange={setDateRange}
      defaultDateRange={dateRange}
      onOpenChange={setIsOpen}
    >
      <TimeSlice.Trigger asChild>
        <div className="flex items-center w-full">
          <div className="flex-1 flex items-center border border-zinc-800 rounded-md px-3 py-2 cursor-pointer">
            <div className="flex items-center w-full">
              <div className="h-[22px] min-w-[44px] bg-zinc-800 rounded-md text-xs text-center mr-2">
                {activeDurationLabel}
              </div>
              <TimeSlice.Input className="bg-transparent text-sm w-full outline-none border-none" />
              <div className={\`transition-transform \${isOpen ? "rotate-180" : ""}\`}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </TimeSlice.Trigger>

      <TimeSlice.Portal className="bg-zinc-900 border border-zinc-800 rounded-md mt-1.5 p-1.5 flex flex-col gap-1">
        <div className="pb-1.5 px-1.5 mb-1 border-b border-zinc-800">
          <div className="text-xs font-medium">Quick select</div>
        </div>
        <TimeSlice.Shortcut duration={{ minutes: 15 }} asChild>
          <div className="hover:bg-zinc-800 p-2 rounded-sm flex items-center justify-between">
            <span>15 minutes</span>
            <span className="text-xs text-zinc-500">15m</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-2 rounded-sm flex items-center justify-between">
            <span>1 hour</span>
            <span className="text-xs text-zinc-500">1h</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-2 rounded-sm flex items-center justify-between">
            <span>1 day</span>
            <span className="text-xs text-zinc-500">1d</span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }} asChild>
          <div className="hover:bg-zinc-800 p-2 rounded-sm flex items-center justify-between">
            <span>1 month</span>
            <span className="text-xs text-zinc-500">1mo</span>
          </div>
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}`
