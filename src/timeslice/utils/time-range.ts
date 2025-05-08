import {
  formatDistanceStrict,
  differenceInYears,
  addYears,
  differenceInMonths,
  addMonths,
  differenceInWeeks,
  addWeeks,
  differenceInDays,
  addDays,
  differenceInHours,
  addHours,
  differenceInMinutes,
  addMinutes,
  isEqual
} from 'date-fns'
import { buildSegments } from '../hooks/use-segment-navigation'

export const formatTimeRange = ({
  start,
  end,
  relative,
  timeZone
}: {
  start?: Date
  end?: Date
  relative: boolean
  timeZone: string
}): string => {
  if (!start || !end) return ''

  if (relative) {
    if (isEqual(start!, end!)) {
      return buildSegments(start!, end!, timeZone).text
    }

    const sMs = start!.getTime()
    const eMs = end!.getTime()
    const nowMs = new Date().getTime()
    const threshold = 5000
    let prefix: string

    if (Math.abs(sMs - nowMs) <= threshold) {
      prefix = eMs > sMs ? 'Next' : 'Past'
    } else if (Math.abs(eMs - nowMs) <= threshold) {
      prefix = sMs < eMs ? 'Past' : 'Next'
    } else {
      prefix = eMs > nowMs ? 'Next' : 'Past'
    }

    let earlierDate: Date
    let laterDate: Date

    if (eMs > sMs) {
      earlierDate = start
      laterDate = end
    } else {
      earlierDate = end
      laterDate = start
    }

    const exactYears = differenceInYears(laterDate, earlierDate)
    if (
      exactYears > 0 &&
      isEqual(addYears(earlierDate, exactYears), laterDate)
    ) {
      return `${prefix} ${formatDistanceStrict(earlierDate, laterDate, { unit: 'year', roundingMethod: 'trunc' })}`
    }

    const exactMonths = differenceInMonths(laterDate, earlierDate)
    if (
      exactMonths > 0 &&
      isEqual(addMonths(earlierDate, exactMonths), laterDate)
    ) {
      return `${prefix} ${formatDistanceStrict(earlierDate, laterDate, { unit: 'month', roundingMethod: 'trunc' })}`
    }

    const exactWeeks = differenceInWeeks(laterDate, earlierDate)
    if (
      exactWeeks > 0 &&
      isEqual(addWeeks(earlierDate, exactWeeks), laterDate)
    ) {
      if (exactWeeks === 1) {
        return `${prefix} 1 week`
      } else {
        return `${prefix} ${exactWeeks} weeks`
      }
    }

    const exactDays = differenceInDays(laterDate, earlierDate)
    if (
      exactDays > 0 &&
      exactDays < 30 &&
      isEqual(addDays(earlierDate, exactDays), laterDate)
    ) {
      return `${prefix} ${formatDistanceStrict(earlierDate, laterDate, { unit: 'day', roundingMethod: 'trunc' })}`
    }

    const exactHours = differenceInHours(laterDate, earlierDate)
    if (
      exactHours > 0 &&
      exactHours < 24 &&
      isEqual(addHours(earlierDate, exactHours), laterDate)
    ) {
      return `${prefix} ${formatDistanceStrict(earlierDate, laterDate, { unit: 'hour', roundingMethod: 'trunc' })}`
    }

    const exactMinutes = differenceInMinutes(laterDate, earlierDate)
    if (
      exactMinutes > 0 &&
      exactMinutes < 60 &&
      isEqual(addMinutes(earlierDate, exactMinutes), laterDate)
    ) {
      return `${prefix} ${formatDistanceStrict(earlierDate, laterDate, { unit: 'minute', roundingMethod: 'trunc' })}`
    }

    // Fallback for relative cases if no specific "exact" unit match was found
    return buildSegments(start!, end!, timeZone).text
  } else {
    // Not relative, or start/end were initially undefined (already handled)
    return buildSegments(start!, end!, timeZone).text
  }
}
