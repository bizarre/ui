import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

describe('StructuredInlay replace/update behavior', () => {
  // NOTE: Tests for update() and replace() functionality have been moved to CT tests
  // in src/inlay/__ct__/inlay.structured-actions.spec.tsx which run in real browsers.
  // JSDOM doesn't properly handle focus and caret positioning for these tests.

  it('accepts custom getPortalAnchorRect prop without errors (smoke)', () => {
    // This smoke test verifies the component accepts and renders with
    // getPortalAnchorRect. Actual anchor positioning is tested in CT tests
    // since JSDOM doesn't properly handle selection/focus to trigger popover.
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

    const getPortalAnchorRect = (root: HTMLDivElement | null) => {
      const r = root ? root.getBoundingClientRect() : new DOMRect(0, 0, 0, 0)
      return new DOMRect(r.left, r.top, 0, 0)
    }

    const { getByTestId } = render(
      <StructuredInlay
        value="@a"
        onChange={() => {}}
        plugins={plugins}
        data-testid="root"
        getPortalAnchorRect={getPortalAnchorRect}
      />
    )

    // Verify the component rendered successfully with the prop
    expect(getByTestId('root')).toBeInTheDocument()
  })
})
