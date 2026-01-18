import React from 'react'
import { TimeSlice } from '@lib'
import type { DateRange } from '@lib/timeslice'
import { ChevronDown } from 'lucide-react'
import {
  differenceInYears,
  differenceInMonths,
  differenceInWeeks,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds
} from 'date-fns'

const colors = {
  bg: '#0A0A0A',
  surface: '#111111',
  border: '#222222',
  text: '#FFFFFF',
  textMuted: '#888888',
  cyan: '#00F0FF'
}

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
    const diffSeconds = differenceInSeconds(end, start)
    const diffMinutes = differenceInMinutes(end, start)
    const diffHours = differenceInHours(end, start)
    const diffDays = differenceInDays(end, start)
    const diffWeeks = differenceInWeeks(end, start)
    const diffMonths = differenceInMonths(end, start)
    const diffYears = differenceInYears(end, start)

    if (diffYears > 0) return `${diffYears}y`
    if (diffMonths > 0) return `${diffMonths}mo`
    if (diffWeeks > 0) return `${diffWeeks}w`
    if (diffDays > 0) return `${diffDays}d`
    if (diffHours > 0) return `${diffHours}h`
    if (diffMinutes > 0) return `${diffMinutes}m`

    return `${diffSeconds}s`
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
          <div
            className="flex-1 flex items-center rounded-lg px-4 py-3 transition-all duration-200 cursor-pointer group"
            style={{
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface
            }}
          >
            <div className="flex items-center space-x-3 w-full">
              <div
                className="h-6 min-w-[48px] rounded text-xs text-center leading-6 font-mono font-medium"
                style={{
                  backgroundColor: `${colors.cyan}20`,
                  color: colors.cyan
                }}
              >
                {activeDurationLabel}
              </div>
              <TimeSlice.Input
                className="bg-transparent text-sm w-full outline-none border-none cursor-pointer overflow-hidden truncate"
                style={{ color: colors.textMuted }}
              />
              <div
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                style={{ color: colors.textMuted }}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </TimeSlice.Trigger>

      <TimeSlice.Portal
        className="relative rounded-lg mt-2 p-1.5 flex flex-col gap-0.5 text-sm shadow-2xl z-50 w-full transition-all duration-100 animate-in fade-in-0 zoom-in-95"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`
        }}
      >
        <div
          className="pb-2 px-2 mb-1"
          style={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <div
            className="text-[10px] font-mono font-medium uppercase tracking-widest"
            style={{ color: colors.textMuted }}
          >
            Quick select
          </div>
        </div>
        <TimeSlice.Shortcut duration={{ minutes: 15 }} asChild>
          <div
            className="p-2.5 rounded-md cursor-pointer transition-colors duration-100 flex items-center justify-between"
            style={{ color: colors.text }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = `${colors.cyan}10`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <span className="text-sm">15 minutes</span>
            <span className="text-xs font-mono" style={{ color: colors.cyan }}>
              15m
            </span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }} asChild>
          <div
            className="p-2.5 rounded-md cursor-pointer transition-colors duration-100 flex items-center justify-between"
            style={{ color: colors.text }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = `${colors.cyan}10`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <span className="text-sm">1 hour</span>
            <span className="text-xs font-mono" style={{ color: colors.cyan }}>
              1h
            </span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }} asChild>
          <div
            className="p-2.5 rounded-md cursor-pointer transition-colors duration-100 flex items-center justify-between"
            style={{ color: colors.text }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = `${colors.cyan}10`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <span className="text-sm">1 day</span>
            <span className="text-xs font-mono" style={{ color: colors.cyan }}>
              1d
            </span>
          </div>
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }} asChild>
          <div
            className="p-2.5 rounded-md cursor-pointer transition-colors duration-100 flex items-center justify-between"
            style={{ color: colors.text }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = `${colors.cyan}10`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <span className="text-sm">1 month</span>
            <span className="text-xs font-mono" style={{ color: colors.cyan }}>
              1mo
            </span>
          </div>
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}
