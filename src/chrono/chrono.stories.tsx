import type { Meta } from '@storybook/react'

import { Chrono } from '..'
import type { ChronoProps } from '.'
import * as React from 'react'

/**
 * Chrono is a flexible time range picker with built-in intelligence.
 * It supports natural language input, relative time handling, and keyboard navigation
 * to provide an intuitive date selection experience.
 *
 * ## Features
 *
 * - 🌐 **Natural language support** - Parse expressions like "last 2 weeks" using chrono-node
 * - ⌨️ **Keyboard navigation** - Edit day, month, year segments with intuitive keyboard shortcuts
 * - 🌍 **Timezone-aware** - Handle time zones properly in your date picker
 * - ♿ **Accessible** - Built with accessibility in mind
 *
 * ## Parameters
 *
 * | Name | Type | Description |
 * |------|------|-------------|
 * | `onDateRangeChange` | `(range: { startDate?: Date, endDate?: Date }) => void` | Callback when date range changes |
 * | `dateRange` | `{ startDate?: Date, endDate?: Date }` | Controlled date range value |
 * | `defaultDateRange` | `{ startDate?: Date, endDate?: Date }` | Initial date range for uncontrolled component |
 * | `formatInput` | `string \| null` | Format for input display (null for absolute dates) |
 *
 * ## Usage
 *
 * ```tsx
 * <Chrono.Root onDateRangeChange={handleChange}>
 *   <Chrono.Input />
 *   <Chrono.Portal>
 *     <Chrono.Shortcut duration={{ hours: 1 }}>1 hour</Chrono.Shortcut>
 *     <Chrono.Shortcut duration={{ days: 1 }}>1 day</Chrono.Shortcut>
 *   </Chrono.Portal>
 * </Chrono.Root>
 * ```
 *
 * ## Use Cases
 *
 * - Analytics dashboards
 * - Log explorers
 * - Data visualization
 * - Monitoring tools
 */
const meta: Meta<typeof Chrono> = {
  component: Chrono.Root,
  title: 'Components/Chrono',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A time range picker with built-in intelligence'
      }
    }
  }
}

export default meta

/**
 * Basic example of the Chrono component showing date range selection with shortcuts.
 */
export const Basic = () => {
  const [dateRange, setDateRange] = React.useState<ChronoProps['dateRange']>({
    startDate: undefined,
    endDate: undefined
  })

  const onDateRangeChange = (dateRange: ChronoProps['dateRange']) => {
    setDateRange(dateRange)
  }

  return (
    <>
      <Chrono.Root onDateRangeChange={onDateRangeChange}>
        <Chrono.Input style={{ border: '1px solid black', width: '100%' }} />
        <Chrono.Portal
          style={{ border: '1px solid black', backgroundColor: 'white' }}
        >
          <Chrono.Shortcut duration={{ minutes: 15 }} asChild>
            <div className="focus:bg-gray-100">15 minutes</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ hours: 1 }}
          >
            <div>1 hour</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut className="focus:bg-gray-100" duration={{ days: 1 }}>
            <div>1 day</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ years: 1 }}
          >
            <div>1 year</div>
          </Chrono.Shortcut>
        </Chrono.Portal>
      </Chrono.Root>

      <pre>{JSON.stringify(dateRange, null, 2)}</pre>
    </>
  )
}

/**
 * Example showing absolute date format instead of relative.
 * Set `formatInput={null}` to use absolute date format.
 */
export const Absolute = () => {
  const [dateRange, setDateRange] = React.useState<ChronoProps['dateRange']>({
    startDate: undefined,
    endDate: undefined
  })

  const onDateRangeChange = (dateRange: ChronoProps['dateRange']) => {
    setDateRange(dateRange)
  }

  return (
    <>
      <Chrono.Root onDateRangeChange={onDateRangeChange} formatInput={null}>
        <Chrono.Input style={{ border: '1px solid black', width: '100%' }} />
        <Chrono.Portal
          style={{ border: '1px solid black', backgroundColor: 'white' }}
        >
          <Chrono.Shortcut duration={{ minutes: 15 }} asChild>
            <div className="focus:bg-gray-100">15 minutes</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ hours: 1 }}
          >
            <div>1 hour</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut className="focus:bg-gray-100" duration={{ days: 1 }}>
            <div>1 day</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ years: 1 }}
          >
            <div>1 year</div>
          </Chrono.Shortcut>
        </Chrono.Portal>
      </Chrono.Root>

      <pre>{JSON.stringify(dateRange, null, 2)}</pre>
    </>
  )
}

/**
 * Example demonstrating future date shortcuts with negative durations.
 * Useful for scheduling and forward-looking date selection.
 */
export const WithFutureShortcuts = () => {
  const [dateRange, setDateRange] = React.useState<ChronoProps['dateRange']>({
    startDate: undefined,
    endDate: undefined
  })

  return (
    <>
      <Chrono.Root onDateRangeChange={setDateRange} dateRange={dateRange}>
        <Chrono.Input style={{ border: '1px solid black', width: '100%' }} />
        <Chrono.Portal
          style={{ border: '1px solid black', backgroundColor: 'white' }}
        >
          <Chrono.Shortcut duration={{ minutes: 15 }} asChild>
            <div className="focus:bg-gray-100">15 minutes</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ hours: -1 }}
          >
            <div>Next hour</div>
          </Chrono.Shortcut>
        </Chrono.Portal>
      </Chrono.Root>

      <pre>{JSON.stringify(dateRange, null, 2)}</pre>
    </>
  )
}

/**
 * Example demonstrating controlled state to prevent future dates.
 * This pattern is useful for validation and restricting date selections.
 */
export const Controlled = () => {
  const [dateRange, setDateRange] = React.useState<ChronoProps['dateRange']>({
    startDate: undefined,
    endDate: undefined
  })

  return (
    <>
      <h1>Prevents future dates via controlled state</h1>
      <Chrono.Root
        onDateRangeChange={({ startDate, endDate }) => {
          // prevent future dates
          if (startDate && endDate && endDate > new Date()) {
            return
          }

          setDateRange({ startDate, endDate })
        }}
        dateRange={dateRange}
      >
        <Chrono.Input style={{ border: '1px solid black', width: '100%' }} />
        <Chrono.Portal
          style={{ border: '1px solid black', backgroundColor: 'white' }}
        >
          <Chrono.Shortcut duration={{ minutes: 15 }} asChild>
            <div className="focus:bg-gray-100">15 minutes</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ hours: 1 }}
          >
            <div>1 hour</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut className="focus:bg-gray-100" duration={{ days: 1 }}>
            <div>1 day</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut
            className="focus:bg-gray-100"
            duration={{ years: 1 }}
          >
            <div>1 year</div>
          </Chrono.Shortcut>
        </Chrono.Portal>
      </Chrono.Root>

      <pre>{JSON.stringify(dateRange, null, 2)}</pre>
    </>
  )
}

/**
 * Datadog-inspired design with custom styling and duration badge.
 * Shows how to create an analytics-style time picker with relative time display.
 */
export const DataDog = () => {
  const [dateRange, setDateRange] = React.useState<ChronoProps['dateRange']>({
    startDate: new Date(Date.now() - 1000 * 60 * 5),
    endDate: new Date()
  })

  const onDateRangeChange = (dateRange: ChronoProps['dateRange']) => {
    setDateRange(dateRange)
  }

  const getDurationBadgeLabel = (ms: number) => {
    // calculate short form, i.e; 2d, 1mo, 5m, etc, using biggest unit
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) return `${years}y`
    if (months > 0) return `${months}mo`
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours % 24}h`
    if (minutes > 0) return `${minutes % 60}m`
    if (seconds > 0) return `${seconds % 60}s`

    return '0s'
  }

  const activeDateRangeBadgeLabel = React.useMemo(() => {
    if (!dateRange) return null

    if (!dateRange.startDate || !dateRange.endDate) return '-'

    return getDurationBadgeLabel(
      dateRange.endDate?.getTime() - dateRange.startDate?.getTime()
    )
  }, [dateRange])

  return (
    <div className="inline-block">
      <Chrono.Root
        onDateRangeChange={onDateRangeChange}
        defaultDateRange={dateRange}
      >
        <Chrono.Trigger asChild>
          <div className="group flex relative border-[1.5px] border-gray-300 h-[28px] items-center p-1 cursor-pointer w-[340px] focus-within:border-blue-800/50 rounded-t-sm not-focus-within:rounded-sm not-focus-within:hover:border-gray-400 focus-within:bg-blue-50 focus-within:text-blue-900">
            <span className="text-[9px] text-gray-600 absolute left-[36px] ml-3 bg-white transition-all duration-150 -top-2.5 px-1 group-focus-within:text-[8px] group-focus-within:text-blue-900  font-mono">
              UTC-04:00
            </span>

            <div className="flex justify-center pr-2">
              <div className="w-[42px] h-[19px] leading-[19px] bg-gray-300 rounded-sm text-center text-xs text-gray-600">
                {activeDateRangeBadgeLabel}
              </div>
            </div>

            <Chrono.Input className="border-none outline-none text-sm cursor-pointer w-full bg-transparent" />
          </div>
        </Chrono.Trigger>
        <Chrono.Portal className="w-full rounded-b-sm border-[1.5px] border-gray-300 border-t-0">
          <Chrono.Shortcut duration={{ minutes: 15 }}>
            <div>15 minutes</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ hours: 1 }}>
            <div>1 hour</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ days: 1 }}>
            <div>1 day</div>
          </Chrono.Shortcut>
          <Chrono.Shortcut duration={{ years: 1 }}>
            <div>1 year</div>
          </Chrono.Shortcut>
        </Chrono.Portal>
      </Chrono.Root>
    </div>
  )
}
