import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import { setDomSelection } from '../../internal/dom-utils'
import type { Plugin } from '../../structured/plugins/plugin'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

describe('StructuredInlay replace/update behavior', () => {
  // NOTE: Tests for update() and replace() functionality have been moved to CT tests
  // in src/inlay/__ct__/inlay.structured-actions.spec.tsx which run in real browsers.
  // JSDOM doesn't properly handle focus and caret positioning for these tests.

  it('uses custom getPortalAnchorRect when provided (smoke)', async () => {
    type T2 = { raw: string }
    const matcher = createRegexMatcher<T2, 'a'>('a', {
      regex: /@a/g,
      transform: (m) => ({ raw: m[0] })
    })

    const plugins: Array<Plugin<unknown, T2, 'a'>> = [
      {
        matcher,
        render: ({ token }: { token: T2 }) => <span>{token.raw}</span>,
        portal: () => <div data-testid="portal">P</div>,
        onInsert: () => {},
        onKeyDown: () => false,
        props: {} as unknown
      }
    ]

    const spy: Array<DOMRect> = []

    function Test() {
      const [value, setValue] = React.useState('@a')
      return (
        <StructuredInlay
          value={value}
          onChange={setValue}
          plugins={plugins}
          data-testid="root"
          getPortalAnchorRect={(root) => {
            const r = root
              ? root.getBoundingClientRect()
              : new DOMRect(0, 0, 0, 0)
            const rect = new DOMRect(r.left, r.top, 0, 0)
            spy.push(rect)
            return rect
          }}
        />
      )
    }

    const { getByTestId } = render(<Test />)
    // Force a selection to cause portal logic to run and the popover to open
    await act(async () => {
      const root = getByTestId('root') as HTMLElement
      setDomSelection(root, 1)
      await flush()
    })

    await waitFor(() => {
      expect(spy.length).toBeGreaterThan(0)
    })
  })
})
