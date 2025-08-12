import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import * as Inlay from '../inlay'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

// Ancestor registration
describe('Inlay ancestor registration', () => {
  it('wraps a token with its ancestor element in the visible weaved output', async () => {
    const { getByTestId } = render(
      <Inlay.Root value={'X'} onChange={() => {}} data-testid="ed">
        <div data-anc="outer">
          <Inlay.Token value="X">
            <span>X</span>
          </Inlay.Token>
        </div>
      </Inlay.Root>
    )

    const editor = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      const token = editor.querySelector('[data-token-text="X"]')
      expect(token).toBeTruthy()
    })

    const wrapped = editor.querySelector(
      '[data-anc="outer"] [data-token-text="X"]'
    )
    expect(wrapped).toBeTruthy()
  })

  it('uses the top-most ancestor, not inner ones, as the captured node (outer wrapper present)', async () => {
    const { getByTestId } = render(
      <Inlay.Root value={'X'} onChange={() => {}} data-testid="ed">
        <div data-anc="outer">
          <div data-anc="inner">
            <Inlay.Token value="X">
              <span>X</span>
            </Inlay.Token>
          </div>
        </div>
      </Inlay.Root>
    )

    const editor = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      const token = editor.querySelector('[data-token-text="X"]')
      expect(token).toBeTruthy()
    })

    const outerWrapped = editor.querySelector(
      '[data-anc="outer"] [data-token-text="X"]'
    )
    expect(outerWrapped).toBeTruthy()
  })

  it('when no ancestor wrapper is present, token renders directly without ancestor', async () => {
    const { getByTestId } = render(
      <Inlay.Root value={'X'} onChange={() => {}} data-testid="ed">
        <Inlay.Token value="X">
          <span>X</span>
        </Inlay.Token>
      </Inlay.Root>
    )

    const editor = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      const token = editor.querySelector('[data-token-text="X"]')
      expect(token).toBeTruthy()
    })

    expect(editor.querySelector('[data-anc]')).toBeFalsy()
  })
})

// Adjacent tokens
describe('Inlay adjacent tokens (weaving)', () => {
  it('renders back-to-back tokens without a spacer', () => {
    const { getByTestId } = render(
      <Inlay.Root value={'@x@x'} onChange={() => {}} data-testid="ed">
        <Inlay.Token value="@x">
          <span>@x</span>
        </Inlay.Token>
        <Inlay.Token value="@x">
          <span>@x</span>
        </Inlay.Token>
      </Inlay.Root>
    )

    const editor = getByTestId('ed') as HTMLElement
    const tokens = editor.querySelectorAll('[data-token-text="@x"]')
    expect(tokens.length).toBe(2)
  })
})

// Registry staleness
describe('Inlay token registry staleness', () => {
  it('when value changes and token child is removed, no stale token renders; plain text is shown', async () => {
    const Test = ({
      value,
      withToken
    }: {
      value: string
      withToken: boolean
    }) => (
      <Inlay.Root value={value} onChange={() => {}} data-testid="ed">
        {withToken ? (
          <Inlay.Token value="X">
            <span>X</span>
          </Inlay.Token>
        ) : (
          <span />
        )}
      </Inlay.Root>
    )

    const { getByTestId, rerender } = render(
      <Test value="X" withToken={true} />
    )
    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text="X"]')).toBeTruthy()
    })

    rerender(<Test value="Y" withToken={false} />)

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeFalsy()
      expect(ed.textContent).toBe('Y')
    })
  })

  it('when value changes but a stale token child remains, it should not appear in the visible editor', async () => {
    const { getByTestId, rerender } = render(
      <Inlay.Root value="X" onChange={() => {}} data-testid="ed">
        <Inlay.Token value="X">
          <span>X</span>
        </Inlay.Token>
      </Inlay.Root>
    )
    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text="X"]')).toBeTruthy()
    })

    rerender(
      <Inlay.Root value="Y" onChange={() => {}} data-testid="ed">
        <Inlay.Token value="X">
          <span>X</span>
        </Inlay.Token>
      </Inlay.Root>
    )

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeFalsy()
    })
  })
})

// External controlled updates
describe('Inlay external controlled updates', () => {
  it('re-weaves tokens when parent changes value (appears/disappears)', async () => {
    function Test() {
      const [value, setValue] = React.useState('A')
      ;(window as any).__setVal = setValue
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <Inlay.Token value="@x">
            <span>@x</span>
          </Inlay.Token>
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeFalsy()
    })

    await act(async () => {
      ;(window as any).__setVal('@x')
      await flush()
    })

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text="@x"]')).toBeTruthy()
    })

    await act(async () => {
      ;(window as any).__setVal('B')
      await flush()
    })

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeFalsy()
    })
  })

  it('context remains usable after external value change (can set selection and get active token)', async () => {
    const ref = React.createRef<Inlay.InlayRef>()
    function Test() {
      const [value, setValue] = React.useState('@x')
      ;(window as any).__setVal2 = setValue
      return (
        <Inlay.Root
          ref={ref}
          value={value}
          onChange={setValue}
          data-testid="ed"
        >
          <Inlay.Token value="@x">
            <span>@x</span>
          </Inlay.Token>
          <Inlay.Portal>
            {({ activeToken }) => (
              <div
                data-testid="ctx"
                data-start={activeToken ? activeToken.start : -1}
                data-end={activeToken ? activeToken.end : -1}
              />
            )}
          </Inlay.Portal>
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeTruthy()
    })

    await act(async () => {
      ;(window as any).__setVal2('A@xB')
      await flush()
    })

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeTruthy()
    })

    await act(async () => {
      ref.current!.setSelection(2)
      await flush()
    })

    await waitFor(() => {
      const ctx = getByTestId('ctx')
      expect(ctx.getAttribute('data-start')).toBe('1')
      expect(ctx.getAttribute('data-end')).toBe('3')
    })
  })
})
