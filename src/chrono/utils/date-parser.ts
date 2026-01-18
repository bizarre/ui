import * as chrono from 'chrono-node'
import { fromUnixTime, isValid } from 'date-fns'
import type { DateRange } from '../hooks/use-chrono-state'

export function parseDateInput(value: string): DateRange {
  let parsed = chrono.parse(value, new Date())

  // try to parse with "last" prefix if direct parse fails
  if (parsed.length === 0) {
    parsed = chrono.parse(`last ${value}`, new Date())
  }

  if (parsed.length > 0) {
    const start = parsed[0].start
    const end = parsed[0].end

    let startDate = start?.date()
    let endDate = end?.date()

    if (startDate && !endDate) {
      if (startDate < new Date()) {
        endDate = new Date()
      } else {
        endDate = startDate
        startDate = new Date()
      }
    }

    if (startDate && endDate) {
      return { startDate, endDate }
    }
  }

  const unixRangeMatch = value.match(/^(\d{10,13})\s*-\s*(\d{10,13})$/)
  if (unixRangeMatch) {
    const startRaw = parseInt(unixRangeMatch[1], 10)
    const endRaw = parseInt(unixRangeMatch[2], 10)

    const startDate =
      unixRangeMatch[1].length === 13
        ? new Date(startRaw)
        : fromUnixTime(startRaw)
    const endDate =
      unixRangeMatch[2].length === 13 ? new Date(endRaw) : fromUnixTime(endRaw)

    if (isValid(startDate) && isValid(endDate)) {
      return { startDate, endDate }
    }
  }

  const unixSingleMatch = value.match(/^(\d{10,13})$/)
  if (unixSingleMatch) {
    const raw = parseInt(unixSingleMatch[1], 10)
    const date =
      unixSingleMatch[1].length === 13 ? new Date(raw) : fromUnixTime(raw)

    if (isValid(date)) {
      const endDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59
      )
      return { startDate: date, endDate }
    }
  }

  return {}
}
