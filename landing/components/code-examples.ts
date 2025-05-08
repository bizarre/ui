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
    
    // Calculate months difference
    const monthDiff = (end.getMonth() + end.getFullYear() * 12) - 
                      (start.getMonth() + start.getFullYear() * 12)
    
    if (monthDiff >= 12) return \`\${Math.floor(monthDiff/12)}y\`
    if (monthDiff > 0) return \`\${monthDiff}mo\`
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(days / 7)
    if (weeks > 0) return \`\${weeks}w\`
    if (days > 0) return \`\${days}d\`
    
    const hours = Math.floor(ms / (1000 * 60 * 60))
    if (hours > 0) return \`\${hours}h\`
    
    const minutes = Math.floor(ms / (1000 * 60))
    if (minutes > 0) return \`\${minutes}m\`
    
    const seconds = Math.floor(ms / 1000)
    return \`\${seconds}s\`
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
