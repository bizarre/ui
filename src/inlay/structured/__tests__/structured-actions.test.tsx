import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import { getAbsoluteOffset, setDomSelection } from '../../internal/dom-utils'
import type { Plugin } from '../../structured/plugins/plugin'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

describe('StructuredInlay replace/update behavior', () => {
  it('update changes rendered label without changing raw; replace moves caret to end', async () => {
    type T = { raw: string; label?: string }
    const matcher = createRegexMatcher<T, 'a'>('a', {
      regex: /@a/g,
      transform: (m) => ({ raw: m[0] })
    })

    let doReplace: ((s: string) => void) | null = null
    let doUpdate: ((d: Partial<T>) => void) | null = null

    const plugins: Array<Plugin<unknown, T, 'a'>> = [
      {
        matcher,
        render: ({ token }: { token: T }) => (
          <span data-testid="tok">{token.label ?? token.raw}</span>
        ),
        portal: ({
          replace,
          update
        }: {
          replace: (s: string) => void
          update: (d: Partial<T>) => void
        }) => {
          doReplace = replace
          doUpdate = update
          return null
        },
        onInsert: () => {},
        onKeyDown: () => false,
        props: {} as unknown
      }
    ]

    function Test() {
      const [value, setValue] = React.useState('@a')
      return (
        <StructuredInlay
          value={value}
          onChange={setValue}
          plugins={plugins}
          data-testid="root"
        />
      )
    }

    const { getByTestId } = render(<Test />)

    // Wait for token weaving
    await waitFor(() => {
      const editor = getByTestId('root') as HTMLElement
      expect(editor.querySelector('[data-token-text]')).toBeTruthy()
    })

    // Activate portal by selecting inside token
    await act(async () => {
      const root = getByTestId('root') as HTMLElement
      setDomSelection(root, 1)
      await flush()
    })

    // Wait for portal callbacks
    await waitFor(() => {
      expect(typeof doReplace).toBe('function')
      expect(typeof doUpdate).toBe('function')
    })

    // 1) update changes rendered label but not raw token text
    await act(async () => {
      if (doUpdate) {
        doUpdate({ label: 'X' })
      }
      await flush()
    })
    await waitFor(() => {
      const editor = getByTestId('root') as HTMLElement
      const tokenEl = editor.querySelector('[data-token-text]') as HTMLElement
      expect(tokenEl.getAttribute('data-token-text')).toBe('@a')
      // Rendered label should be updated
      expect(
        (editor.querySelector('[data-testid="tok"]') as HTMLElement).textContent
      ).toBe('X')
    })

    // 2) replace moves caret to end of inserted text
    await act(async () => {
      if (doReplace) {
        doReplace('@alex')
      }
      await flush()
    })
    await waitFor(() => {
      const root = getByTestId('root') as HTMLElement
      const sel = window.getSelection()!
      const caret = getAbsoluteOffset(root, sel.focusNode!, sel.focusOffset)
      expect(caret).toBe('@alex'.length)
    })
  })

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
