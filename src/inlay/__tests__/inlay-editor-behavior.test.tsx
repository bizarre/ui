import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import * as Inlay from '../inlay'
import { getAbsoluteOffset, setDomSelection } from '../internal/dom-utils'

function flush() {
  return new Promise((r) => setTimeout(r, 0))
}

// Editing basics (Space/Enter) — Backspace covered in its own block below
describe('Inlay editing (Space/Enter)', () => {
  it('Space and Enter modify value appropriately', async () => {
    function Test() {
      const [value, setValue] = React.useState('ab')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="editor">
          <span />
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('editor') as HTMLElement

    await act(async () => {
      ;(ed as HTMLElement).focus()
      setDomSelection(ed as HTMLElement, 2)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: ' ' })
      await flush()
    })
    expect((ed as HTMLElement).textContent).toBe('ab ')

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Enter' })
      await flush()
    })
    expect((ed as HTMLElement).textContent).toBe('ab \n')

    // Backspace semantics are covered separately
  })
})

// Backspace semantics
describe('Inlay Backspace semantics', () => {
  it('does nothing at start of content (collapsed at 0)', async () => {
    function Test() {
      const [value, setValue] = React.useState('ab')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, 0)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('ab')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(0)
  })

  it('deletes previous char when collapsed (not at start)', async () => {
    function Test() {
      const [value, setValue] = React.useState('ab')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, 2)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('a')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(1)
  })

  it('deletes selected range (within plain text)', async () => {
    function Test() {
      const [value, setValue] = React.useState('abcd')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, 1, 3) // select 'bc'
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('ad')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(1)
  })

  it('range delete across a token removes the token raw span', async () => {
    function Test() {
      const [value, setValue] = React.useState('A@xB')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          {/* Register token for '@x' so weaving recognizes it */}
          <Inlay.Token value="@x">
            <span>@x</span>
          </Inlay.Token>
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await waitFor(() => {
      expect(ed.querySelector('[data-token-text="@x"]')).toBeTruthy()
    })

    await act(async () => {
      ed.focus()
      setDomSelection(ed, 1, 3)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.querySelector('[data-token-text]')).toBeFalsy()
  })

  it('collapsed backspace at end of token deletes last raw char of token', async () => {
    function Test() {
      const [value, setValue] = React.useState('A@xB')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <Inlay.Token value="@x">
            <span>@x</span>
          </Inlay.Token>
          <Inlay.Portal>
            {({ value }) => <div data-testid="ctx-val" data-value={value} />}
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
      ed.focus()
      setDomSelection(ed, 3) // right after '@x'
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    // Deletes 'x' -> raw becomes 'A@B'; token no longer matches
    const ctxVal = getByTestId('ctx-val')
    expect(ctxVal.getAttribute('data-value')).toBe('A@B')
    expect(ed.querySelector('[data-token-text]')).toBeFalsy()
  })
})

// onKeyDown interception
describe('Inlay onKeyDown interception', () => {
  it('returns true to prevent built-in handling (Space, Enter)', async () => {
    const ref = React.createRef<Inlay.InlayRef>()

    function Test() {
      const [value, setValue] = React.useState('ab')
      const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === ' ' || e.key === 'Enter') return true
        return false
      }
      return (
        <Inlay.Root
          ref={ref}
          value={value}
          onChange={setValue}
          onKeyDown={onKeyDown}
          data-testid="ed"
        >
          <span />
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ref.current!.setSelection(2)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: ' ' })
      await flush()
    })
    expect(ed.textContent).toBe('ab')

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Enter' })
      await flush()
    })
    expect(ed.textContent).toBe('ab')
  })
})

// Newline rendering
describe('Inlay trailing newline rendering', () => {
  it('adds a <br> when value ends with \n (when at least one token is present)', () => {
    function Test({ value }: { value: string }) {
      return (
        <Inlay.Root value={value} onChange={() => {}} data-testid="root">
          <Inlay.Token value={'X'}>
            <span>X</span>
          </Inlay.Token>
        </Inlay.Root>
      )
    }

    const { getByTestId, rerender } = render(<Test value={'X\n'} />)
    const editor = getByTestId('root') as HTMLElement
    expect(editor.querySelector('br')).toBeTruthy()

    rerender(<Test value={'X'} />)
    expect(editor.querySelector('br')).toBeFalsy()
  })

  it('first Enter on empty editor creates a visible newline (trailing <br>)', async () => {
    function Test() {
      const [value, setValue] = React.useState('')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      fireEvent.keyDown(ed, { key: 'Enter' })
      await flush()
    })

    // Expect a trailing <br> to appear immediately after first Enter
    expect(ed.querySelector('br')).toBeTruthy()
  })
})

// Grapheme cluster behavior
describe('Inlay Backspace with grapheme clusters', () => {
  it('deletes full grapheme cluster (emoji + skin tone) when collapsed', async () => {
    function Test() {
      const [value, setValue] = React.useState('👍🏼')
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, '👍🏼'.length) // caret after the cluster
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(0)
  })

  it('deletes an entire flag grapheme (regional indicators) before caret', async () => {
    const flag = '🇺🇸'
    function Test() {
      const [value, setValue] = React.useState(`a${flag}b`)
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    const value = `a${flag}b`
    const posAfterFlag = value.indexOf(flag) + flag.length

    await act(async () => {
      ed.focus()
      setDomSelection(ed, posAfterFlag)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('ab')
  })

  it('deletes composed character with combining mark as a single grapheme', async () => {
    const composed = 'e\u0301' // e + combining acute
    function Test() {
      const [value, setValue] = React.useState(composed)
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, composed.length)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    expect(ed.textContent).toBe('')
  })
})

describe('Inlay selection deletion is grapheme-aware', () => {
  it('Backspace with selection slicing through a grapheme deletes the whole grapheme', async () => {
    const cluster = '👍🏼'
    const text = `a${cluster}b`
    function Test() {
      const [value, setValue] = React.useState(text)
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    const start = 1 + 1 // into the grapheme
    const end = 1 + cluster.length - 1 // still inside the grapheme

    await act(async () => {
      ed.focus()
      setDomSelection(ed, start, end)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })

    // Expect entire grapheme removed, leaving 'ab'
    expect(ed.textContent).toBe('ab')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(1)
  })

  it('Delete with selection slicing through a grapheme deletes the whole grapheme', async () => {
    const cluster = '🇺🇸'
    const text = `x${cluster}y`
    function Test() {
      const [value, setValue] = React.useState(text)
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    const start = 1 // start at grapheme start
    const end = 1 + 1 // end in the middle of grapheme

    await act(async () => {
      ed.focus()
      setDomSelection(ed, start, end)
      await flush()
    })

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Delete' })
      await flush()
    })

    expect(ed.textContent).toBe('xy')
    const sel = window.getSelection()!
    const caret = getAbsoluteOffset(ed, sel.focusNode!, sel.focusOffset)
    expect(caret).toBe(1)
  })
})

// ZWJ grapheme sequences and selection snapping
describe('Inlay grapheme advanced cases', () => {
  it('Backspace/Delete remove whole ZWJ grapheme (family emoji)', async () => {
    const family = '👨‍👩‍👧‍👦'
    function Test() {
      const [value, setValue] = React.useState(family)
      return (
        <Inlay.Root value={value} onChange={setValue} data-testid="ed">
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId, rerender } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      setDomSelection(ed, family.length)
      await flush()
    })
    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Backspace' })
      await flush()
    })
    expect(ed.textContent).toBe('')

    // Reset and test Delete
    rerender(
      <Inlay.Root value={family} onChange={() => {}} data-testid="ed">
        <span />
      </Inlay.Root>
    )
    await act(async () => {
      ed.focus()
      setDomSelection(ed, 0)
      await flush()
    })
    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Delete' })
      await flush()
    })
    expect(ed.textContent).toBe('')
  })

  it('setSelection snaps to grapheme boundaries', async () => {
    const cluster = '👍🏼'
    const text = `a${cluster}b`
    const ref = React.createRef<Inlay.InlayRef>()
    function Test() {
      const [value, setValue] = React.useState(text)
      return (
        <Inlay.Root
          ref={ref}
          value={value}
          onChange={setValue}
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
                  data-raw-start={rawStart}
                  data-raw-end={rawEnd}
                />
              )
            }}
          </Inlay.Portal>
          <span />
        </Inlay.Root>
      )
    }
    const { getByTestId } = render(<Test />)

    const mid = 1 + Math.floor(cluster.length / 2)
    await act(async () => {
      ref.current!.setSelection(mid)
      await flush()
    })

    const ctx = getByTestId('ctx')
    // Expect snapped to start of grapheme (offset 1)
    expect(ctx.getAttribute('data-start')).toBe('1')
    expect(ctx.getAttribute('data-end')).toBe('1')
    expect(ctx.getAttribute('data-raw-start')).toBe('1')
    expect(ctx.getAttribute('data-raw-end')).toBe('1')
  })
})

// Placeholder
describe('Inlay placeholder', () => {
  it('shows placeholder only when value is empty', () => {
    const placeholder = 'Type here...'
    const { container, rerender } = render(
      <Inlay.Root value={''} onChange={() => {}} placeholder={placeholder}>
        <span />
      </Inlay.Root>
    )

    expect(container.textContent).toContain(placeholder)

    rerender(
      <Inlay.Root value={'x'} onChange={() => {}} placeholder={placeholder}>
        <span />
      </Inlay.Root>
    )

    expect(container.textContent).not.toContain(placeholder)
  })
})

// Multiline behavior
describe('Inlay multiline prop', () => {
  it('multiline=false blocks Enter and Shift+Enter on empty editor', async () => {
    function Test() {
      const [value, setValue] = React.useState('')
      return (
        <Inlay.Root
          multiline={false}
          value={value}
          onChange={setValue}
          data-testid="ed"
        >
          <span />
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement

    await act(async () => {
      ed.focus()
      fireEvent.keyDown(ed, { key: 'Enter' })
      await flush()
    })
    expect(ed.querySelector('br')).toBeFalsy()
    expect(ed.textContent).toBe('')

    await act(async () => {
      fireEvent.keyDown(ed, { key: 'Enter', shiftKey: true })
      await flush()
    })
    expect(ed.querySelector('br')).toBeFalsy()
    expect(ed.textContent).toBe('')
  })

  it('multiline=false does not render trailing <br> even if value ends with \n', async () => {
    function Test() {
      const [value, setValue] = React.useState('A\n')
      return (
        <Inlay.Root
          multiline={false}
          value={value}
          onChange={setValue}
          data-testid="ed"
        >
          <span />
        </Inlay.Root>
      )
    }

    const { getByTestId } = render(<Test />)
    const ed = getByTestId('ed') as HTMLElement
    expect(ed.querySelector('br')).toBeFalsy()
  })
})
