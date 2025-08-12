import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import { getAbsoluteOffset, setDomSelection } from '../../internal/dom-utils'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

describe('StructuredInlay replace/update behavior', () => {
  it('update changes rendered label without changing raw; replace moves caret to end', async () => {
    const matcher = createRegexMatcher<{ raw: string; label?: string }, 'a'>(
      'a',
      {
        regex: /@a/g,
        transform: (m) => ({ raw: m[0] })
      }
    )

    let doReplace: ((s: string) => void) | null = null
    let doUpdate: ((d: any) => void) | null = null

    const plugins = [
      {
        matcher,
        render: ({ token }: any) => (
          <span data-testid="tok">{token.label ?? token.raw}</span>
        ),
        portal: ({ replace, update }: any) => {
          doReplace = replace
          doUpdate = update
          return null
        }
      }
    ] as any

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
      doUpdate && doUpdate({ label: 'X' })
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
      doReplace && doReplace('@alex')
      await flush()
    })
    await waitFor(() => {
      const root = getByTestId('root') as HTMLElement
      const sel = window.getSelection()!
      const caret = getAbsoluteOffset(root, sel.focusNode!, sel.focusOffset)
      expect(caret).toBe('@alex'.length)
    })
  })
})
