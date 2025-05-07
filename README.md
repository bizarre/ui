# @bizarre/ui

[![npm version](https://img.shields.io/npm/v/@bizarre/ui.svg)](https://www.npmjs.com/package/@bizarre/ui)
[![CI Tests](https://github.com/bizarre/ui/actions/workflows/ci-tests.yml/badge.svg?branch=master)](https://github.com/bizarre/ui/actions/workflows/ci-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Headless component library for the weird parts of UI.

## Installation

You can install `@bizarre/ui` using your favorite package manager:

```bash
# Bun
bun add @bizarre/ui

# npm
npm install @bizarre/ui

# yarn
yarn add @bizarre/ui

# pnpm
pnpm add @bizarre/ui
```

## Components

This library aims to provide a collection of headless UI components. Currently, the following components are available:

### 1. TimeSlice

A flexible and intelligent time range picker.

**Key Features:**

- **Natural Language Input:** Understands phrases like "last 3 days" or "yesterday to now" using [chrono-node](https://github.com/wanasit/chrono).
- **Relative Time Ranges:** Handles dynamic ranges like "last hour" or "past 7 days" with automatic updates.
- **Composable API:** Customize the UI completely to match your application's design.
- **Keyboard Accessible:** Full keyboard navigation for selecting and modifying time segments (day, month, year, hour, minute).
- **Timezone-Aware:** Supports timezone considerations in calculations.
- **Performance Optimized:** Designed to be efficient.
- **Accessible by Default:** Built with accessibility in mind.

**Basic Usage:**

```tsx
import { TimeSlice } from '@bizarre/ui/timeslice'

function MyComponent() {
  const handleChange = (dateRange) => {
    console.log('Selected range:', dateRange)
  }

  return (
    <TimeSlice.Root onDateRangeChange={handleChange}>
      <TimeSlice.Input />
      <TimeSlice.Portal>
        {/* Optional: Add shortcuts or other custom elements here */}
        <TimeSlice.Shortcut duration={{ minutes: 15 }}>
          15 minutes
        </TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ hours: 1 }}>1 hour</TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ days: 1 }}>1 day</TimeSlice.Shortcut>
        <TimeSlice.Shortcut duration={{ months: 1 }}>
          1 month
        </TimeSlice.Shortcut>
      </TimeSlice.Portal>
    </TimeSlice.Root>
  )
}
```

**Good For:**

- Analytics dashboards
- Log & event explorers
- Data visualization tools
- Monitoring applications

---

_(More components will be documented here as they are added.)_

## Storybook

Explore the components in action and see more examples in our [Storybook](https://ui.bizar.re/storybook).

## Contributing

Contributions are welcome. If you'd like to help out:

- **Issues:** Found a bug or have an idea? Open an issue on GitHub. Please include details, especially steps to reproduce for bugs.
- **Pull Requests:** For code changes, fork the repository and submit a pull request to the `master` branch. Try to stick to the existing code style and ensure tests pass.

Thanks for considering contributing!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
