# `@bizarre/ui` &nbsp;🧠👻

[![npm version](https://img.shields.io/npm/v/@bizarre/ui.svg)](https://www.npmjs.com/package/@bizarre/ui)  
[![CI Tests](https://github.com/bizarre/ui/actions/workflows/ci-tests.yml/badge.svg?branch=master)](https://github.com/bizarre/ui/actions/workflows/ci-tests.yml)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Headless UI components for the edges of the web.**  
> Wrote these so I could ship weird stuff faster. You can too.

---

## 📦 Installation

```
bun add @bizarre/ui
```

Or use `npm`, `yarn`, or `pnpm`. Whatever you like.

---

## 🧩 Components

### `Chrono`

A smart, headless time range picker that speaks human.

#### 🔑 Features

- 🧠 **Natural language input** – understands `"last 3 days"` or `"yesterday to tomorrow"` (powered by [`chrono-node`](https://github.com/wanasit/chrono))
- ⏳ **Relative time ranges** – like `"last hour"` or `"past 15 minutes"`
- 🧱 **Fully composable** – render it your way
- 🧭 **Keyboard accessible** – arrow keys, tab jumping, full control
- 🌍 **Timezone-aware**
- ⚡ **Performance-tuned**
- ♿ **Accessible by default**

#### 🛠 Basic Usage

```tsx
import { Chrono } from '@bizarre/ui'

function MyComponent() {
  const handleConfirm = (range) => {
    console.log('Selected range:', range)
  }

  return (
    <Chrono.Root onDateRangeConfirm={handleConfirm}>
      <Chrono.Input />
      <Chrono.Portal>
        <Chrono.Shortcut duration={{ minutes: 15 }}>
          15 minutes
        </Chrono.Shortcut>
        <Chrono.Shortcut duration={{ hours: 1 }}>1 hour</Chrono.Shortcut>
        <Chrono.Shortcut duration={{ days: 1 }}>1 day</Chrono.Shortcut>
        <Chrono.Shortcut duration={{ months: 1 }}>
          1 month
        </Chrono.Shortcut>
      </Chrono.Portal>
    </Chrono.Root>
  )
}
```

#### 🧰 Perfect For

- Dashboards & analytics
- Log & event explorers
- Data viz
- Monitoring tools

---

## 📘 [Storybook](https://ui.bizar.re/storybook)

Live demos. Keyboard magic. Check it out.

---

## 🤝 Contributing

Help make it weirder (or better). PRs and issues welcome:

- Open bugs or ideas in GitHub Issues
- Fork + PR to `master`
- Keep it tested, readable, and accessible

---

## ⚖️ License

MIT — do wtvtf
