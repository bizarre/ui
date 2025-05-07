import { vi } from 'vitest'

describe('useSegmentNavigation: Environment Checks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Test Environment Timezone Support', () => {
    it('Intl.DateTimeFormat should correctly format a UTC date to America/New_York time', () => {
      const utcDate = new Date('2024-01-01T12:00:00Z')

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      })
      expect(formatter.format(utcDate).toUpperCase()).toBe('7:00 AM')
    })

    it('Intl.DateTimeFormat should correctly format a UTC date to Europe/London time (handles GMT/BST)', () => {
      const utcDateSummer = new Date('2024-07-01T12:00:00Z')

      const formatterSummer = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      })
      expect(formatterSummer.format(utcDateSummer)).toBe('13:00')

      const utcDateWinter = new Date('2024-01-01T12:00:00Z')

      const formatterWinter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      })
      expect(formatterWinter.format(utcDateWinter)).toBe('12:00')
    })
  })
})
