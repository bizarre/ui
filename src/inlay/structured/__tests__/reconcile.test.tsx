import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'

type TData = { name?: string; raw: string }

function plugin() {
  const matcher = createRegexMatcher<TData, 'a'>('a', {
    regex: /@a/g,
    transform: (m) => ({ raw: m[0] })
  })

  const updates: Array<(d: Partial<TData>) => void> = []

  return {
    matcher,
    render: ({
      token,
      update
    }: {
      token: TData
      update: (d: Partial<TData>) => void
    }) => {
      updates.push(update)
      return <span data-testid="tok">{token.name ?? token.raw}</span>
    },
    portal: () => null,
    updates
  }
}

describe('StructuredInlay reconcile', () => {
  it('preserves token data across edits for duplicates via nearest-unused matching', async () => {
    const p = plugin()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function Test({ value, onChange }: any) {
      return (
        <StructuredInlay
          value={value}
          onChange={onChange}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plugins={[p] as any}
        />
      )
    }

    let value = '@a x @a'
    const onChange = (v: string) => {
      value = v
    }

    const { container, rerender } = render(
      <Test value={value} onChange={onChange} />
    )

    const editor = container.querySelector('[contenteditable="true"]')!
    expect(editor.querySelectorAll('[data-testid="tok"]').length).toBe(2)

    await act(async () => {
      p.updates[0]({ name: 'X' })
    })

    await act(async () => {
      rerender(<Test value={'@a@a'} onChange={() => {}} />)
    })

    const labels = Array.from(
      editor.querySelectorAll('[data-testid="tok"]')
    ).map((n) => n.textContent)
    expect(labels).toContain('X')
  })
})
