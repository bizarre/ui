import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import * as Inlay from '../inlay'
import { getAbsoluteOffset } from '../internal/dom-utils'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

describe('Inlay public selection API', () => {
  it('setSelection updates public context and getSelectionRange round-trips to same raw offsets', async () => {
    const ref = React.createRef<Inlay.InlayRef>()

    const Test = () => (
      <Inlay.Root
        ref={ref}
        value={'abcdef'}
        onChange={() => {}}
        data-testid="ed"
      >
        <Inlay.Portal>
          {({ selection, getSelectionRange }) => {
            const range = getSelectionRange()
            let rawStart = -1
            let rawEnd = -1
            const root = ref.current?.root
            if (root && range) {
              rawStart = getAbsoluteOffset(
                root,
                range.startContainer,
                range.startOffset
              )
              rawEnd = getAbsoluteOffset(
                root,
                range.endContainer,
                range.endOffset
              )
            }
            return (
              <div
                data-testid="ctx"
                data-start={selection.start}
                data-end={selection.end}
                data-range={range ? '1' : '0'}
                data-raw-start={rawStart}
                data-raw-end={rawEnd}
              />
            )
          }}
        </Inlay.Portal>
      </Inlay.Root>
    )

    const { getByTestId } = render(<Test />)

    await act(async () => {
      ref.current!.setSelection(1, 3)
      await flush()
    })

    await waitFor(() => {
      const ctx = getByTestId('ctx')
      expect(ctx.getAttribute('data-start')).toBe('1')
      expect(ctx.getAttribute('data-end')).toBe('3')
      expect(ctx.getAttribute('data-range')).toBe('1')
      expect(ctx.getAttribute('data-raw-start')).toBe('1')
      expect(ctx.getAttribute('data-raw-end')).toBe('3')
    })
  })
})

describe('Inlay active token and state', () => {
  it('middle/end for non-diverged token; start boundary is spacer', async () => {
    const ref = React.createRef<Inlay.InlayRef>()
    const { getByTestId } = render(
      <Inlay.Root ref={ref} value={'A@xB'} onChange={() => {}} data-testid="ed">
        <Inlay.Token value="@x">
          <span>@x</span>
        </Inlay.Token>
        <Inlay.Portal>
          {({ activeToken, activeTokenState }) => (
            <div
              data-testid="ctx"
              data-start={activeToken ? activeToken.start : -1}
              data-end={activeToken ? activeToken.end : -1}
              data-collapsed={activeTokenState?.isCollapsed ? '1' : '0'}
              data-atstart={activeTokenState?.isAtStartOfToken ? '1' : '0'}
              data-atend={activeTokenState?.isAtEndOfToken ? '1' : '0'}
            />
          )}
        </Inlay.Portal>
      </Inlay.Root>
    )

    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeTruthy()
    })

    // Start boundary selects spacer [0,1]
    await act(async () => {
      ref.current!.setSelection(1)
      await flush()
    })
    await waitFor(() => {
      const ctx = document.querySelector('[data-testid="ctx"]') as HTMLElement
      expect(ctx.getAttribute('data-start')).toBe('0')
      expect(ctx.getAttribute('data-end')).toBe('1')
      expect(ctx.getAttribute('data-collapsed')).toBe('1')
      expect(ctx.getAttribute('data-atstart')).toBe('0')
      expect(ctx.getAttribute('data-atend')).toBe('1')
    })

    // Middle of token (offset 2)
    await act(async () => {
      ref.current!.setSelection(2)
      await flush()
    })
    await waitFor(() => {
      const ctx = document.querySelector('[data-testid="ctx"]') as HTMLElement
      expect(ctx.getAttribute('data-start')).toBe('1')
      expect(ctx.getAttribute('data-end')).toBe('3')
      expect(ctx.getAttribute('data-collapsed')).toBe('1')
      expect(ctx.getAttribute('data-atstart')).toBe('0')
      expect(ctx.getAttribute('data-atend')).toBe('0')
    })

    // End of token (offset 3)
    await act(async () => {
      ref.current!.setSelection(3)
      await flush()
    })
    await waitFor(() => {
      const ctx = document.querySelector('[data-testid="ctx"]') as HTMLElement
      expect(ctx.getAttribute('data-start')).toBe('1')
      expect(ctx.getAttribute('data-end')).toBe('3')
      expect(ctx.getAttribute('data-collapsed')).toBe('1')
      expect(ctx.getAttribute('data-atstart')).toBe('0')
      expect(ctx.getAttribute('data-atend')).toBe('1')
    })
  })

  it('diverged: start boundary is spacer; end-of-token reports atEnd', async () => {
    const ref = React.createRef<Inlay.InlayRef>()
    const { getByTestId } = render(
      <Inlay.Root
        ref={ref}
        value={'X@alexY'}
        onChange={() => {}}
        data-testid="ed"
      >
        <Inlay.Token value="@alex">
          <span>Alex</span>
        </Inlay.Token>
        <Inlay.Portal>
          {({ activeToken, activeTokenState }) => (
            <div
              data-testid="ctx"
              data-start={activeToken ? activeToken.start : -1}
              data-end={activeToken ? activeToken.end : -1}
              data-collapsed={activeTokenState?.isCollapsed ? '1' : '0'}
              data-atstart={activeTokenState?.isAtStartOfToken ? '1' : '0'}
              data-atend={activeTokenState?.isAtEndOfToken ? '1' : '0'}
            />
          )}
        </Inlay.Portal>
      </Inlay.Root>
    )

    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text]')).toBeTruthy()
    })

    // Start boundary is spacer [0,1]
    await act(async () => {
      ref.current!.setSelection(1)
      await flush()
    })
    await waitFor(() => {
      const ctx = document.querySelector('[data-testid="ctx"]') as HTMLElement
      expect(ctx.getAttribute('data-start')).toBe('0')
      expect(ctx.getAttribute('data-end')).toBe('1')
      expect(ctx.getAttribute('data-atstart')).toBe('0')
      expect(ctx.getAttribute('data-atend')).toBe('1')
    })

    // End of token (offset 6)
    await act(async () => {
      ref.current!.setSelection(6)
      await flush()
    })
    await waitFor(() => {
      const ctx = document.querySelector('[data-testid="ctx"]') as HTMLElement
      expect(ctx.getAttribute('data-atstart')).toBe('0')
      expect(ctx.getAttribute('data-atend')).toBe('1')
    })
  })
})
