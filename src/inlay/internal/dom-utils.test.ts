import { describe, it, expect } from 'vitest'
import { getAbsoluteOffset, getTextNodeAtOffset } from './dom-utils'

// Helper to build a minimal editor DOM tree
function createEditor(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('dom-utils', () => {
  it('getAbsoluteOffset on plain text accumulates correctly', () => {
    const root = createEditor('<span>hello</span><span> world</span>')
    const firstText = root.querySelector('span')!.firstChild as Text
    const secondText = root.querySelectorAll('span')[1].firstChild as Text

    expect(getAbsoluteOffset(root, firstText, 0)).toBe(0) // h|
    expect(getAbsoluteOffset(root, firstText, 5)).toBe(5) // hello|
    expect(getAbsoluteOffset(root, secondText, 1)).toBe(6) // hello␠|
  })

  it('getTextNodeAtOffset on plain text maps back to nodes/offsets', () => {
    const root = createEditor('<span>hello</span><span> world</span>')
    const [n0, o0] = getTextNodeAtOffset(root, 0)
    expect((n0 as Text).data.slice(0, o0)).toBe('')

    const [n5, o5] = getTextNodeAtOffset(root, 5)
    expect((n5 as Text).data.slice(0, o5)).toBe('hello')

    const [n7, o7] = getTextNodeAtOffset(root, 7)
    expect((n7 as Text).data.slice(0, o7)).toBe(' w')
  })

  it('diverged token: absolute offset snaps to token edges when inside token', () => {
    const root = createEditor(
      '<span>hi </span>' +
        '<span data-token-text="@alex"><span>Alex</span></span>' +
        '<span>!</span>'
    )
    const token = root.querySelector('[data-token-text]') as HTMLElement
    const tokenInner = token.querySelector('span')!.firstChild as Text // "Alex"

    // Inside first char of rendered token should snap to start of raw token (offset at start of token = 3)
    expect(getAbsoluteOffset(root, tokenInner, 1)).toBe(3)

    // Inside last char of rendered token should snap to end of raw token (raw len = 5, base start = 3, so end = 8)
    expect(getAbsoluteOffset(root, tokenInner, 4)).toBe(8)
  })

  it('round-trip sweep over all offsets in mixed content (snap inside diverged token)', () => {
    const root = createEditor(
      '<span>X</span>' +
        '<span data-token-text="@alex"><span>Alex</span></span>' +
        '<span>Y</span>'
    )
    // raw: "X@alexY" -> token starts at 1, rawLen=5, tokenEnd=6, total len=7
    const tokenStart = 1
    const tokenRawLen = 5
    const tokenEnd = tokenStart + tokenRawLen
    for (let i = 0; i <= 7; i++) {
      const [n, o] = getTextNodeAtOffset(root, i)
      const roundTrip = getAbsoluteOffset(root, n as Node, o)
      const expected =
        i < tokenStart || i > tokenEnd
          ? i
          : i - tokenStart <= tokenRawLen / 2
            ? tokenStart
            : tokenEnd
      expect(roundTrip).toBe(expected)
    }
  })

  it('fallbacks: offsets past end clamp to last text node end', () => {
    const root = createEditor('<span>abc</span>')
    const [n, o] = getTextNodeAtOffset(root, 999)
    expect((n as Text).data.length).toBe(3)
    expect(o).toBe(3)
  })
})
