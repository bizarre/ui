import { describe, it, expect } from 'vitest'
import {
  createRegexMatcher,
  filterMatchesByMatcher,
  groupMatchesByMatcher,
  scan
} from './string-utils'

describe('string-utils', () => {
  it('createRegexMatcher + scan: finds and sorts matches with names', () => {
    const mention = createRegexMatcher<{ mention: string }, 'mention'>(
      'mention',
      {
        regex: /@\w+/g,
        transform: (m) => ({ mention: m[0] })
      }
    )

    const text = 'hi @alex and @bob'
    const matches = scan(text, [mention])

    expect(matches.map((m) => m.raw)).toEqual(['@alex', '@bob'])
    expect(matches.map((m) => m.start)).toEqual([3, 13])
    expect(matches.every((m) => m.matcher === 'mention')).toBe(true)
  })

  it('createRegexMatcher resets lastIndex between scans', () => {
    const word = createRegexMatcher<{ w: string }, 'word'>('word', {
      regex: /\w+/g,
      transform: (m) => ({ w: m[0] })
    })

    const a = scan('alpha beta', [word])
    const b = scan('gamma', [word])

    expect(a.map((m) => m.raw)).toEqual(['alpha', 'beta'])
    expect(b.map((m) => m.raw)).toEqual(['gamma'])
  })

  it('filterMatchesByMatcher returns only requested matcher type', () => {
    const mention = createRegexMatcher<{ mention: string }, 'mention'>(
      'mention',
      { regex: /@\w+/g, transform: (m) => ({ mention: m[0] }) }
    )
    const hash = createRegexMatcher<{ tag: string }, 'hashtag'>('hashtag', {
      regex: /#\w+/g,
      transform: (m) => ({ tag: m[0] })
    })

    const matches = scan('say @alex and #music', [mention, hash])

    const onlyMentions = filterMatchesByMatcher(matches, 'mention')
    expect(onlyMentions.map((m) => m.raw)).toEqual(['@alex'])
  })

  it('groupMatchesByMatcher groups by matcher name', () => {
    const m1 = createRegexMatcher<{ v: string }, 'a'>('a', {
      regex: /a/g,
      transform: (m) => ({ v: m[0] })
    })
    const m2 = createRegexMatcher<{ v: string }, 'b'>('b', {
      regex: /b/g,
      transform: (m) => ({ v: m[0] })
    })

    const matches = scan('ababa', [m1, m2])
    const grouped = groupMatchesByMatcher(matches)

    expect(grouped.a?.map((x) => x.raw)).toEqual(['a', 'a', 'a'])
    expect(grouped.b?.map((x) => x.raw)).toEqual(['b', 'b'])
  })

  it('createRegexMatcher throws when regex lacks global flag', () => {
    expect(() =>
      // @ts-expect-error intentional invalid regex config for test
      createRegexMatcher('bad', { regex: /@\w+/, transform: (m) => m[0] })
    ).toThrow()
  })

  it('createRegexMatcher throws when regex uses sticky flag', () => {
    expect(() =>
      // @ts-expect-error intentional invalid regex config for test
      createRegexMatcher('bad', { regex: /@\w+/gy, transform: (m) => m[0] })
    ).toThrow()
  })

  it('scan filters overlapping matches - longer match wins', () => {
    const atWord = createRegexMatcher<{ v: string }, 'at'>('at', {
      regex: /@\w+/g,
      transform: (m) => ({ v: m[0] })
    })
    const word = createRegexMatcher<{ v: string }, 'word'>('word', {
      regex: /\w+/g,
      transform: (m) => ({ v: m[0] })
    })

    // @alex (5 chars starting at 0) vs alex (4 chars starting at 1)
    // They overlap, and @alex is longer, so only @alex should be returned
    const matches = scan('@alex', [atWord, word])
    expect(matches.map((m) => `${m.matcher}:${m.raw}`)).toEqual(['at:@alex'])
  })

  it('scan: longest match wins when two matchers start at same position', () => {
    const short = createRegexMatcher<{ v: string }, 'short'>('short', {
      regex: /@alice/g,
      transform: (m) => ({ v: m[0] })
    })
    const long = createRegexMatcher<{ v: string }, 'long'>('long', {
      regex: /@alice_vip/g,
      transform: (m) => ({ v: m[0] })
    })

    // Both match starting at position 0, but long is 10 chars vs short's 6
    const matches = scan('@alice_vip', [short, long])
    expect(matches.map((m) => `${m.matcher}:${m.raw}`)).toEqual([
      'long:@alice_vip'
    ])
  })

  it('scan: first matcher wins when matches are exact same range', () => {
    const pluginA = createRegexMatcher<{ v: string }, 'a'>('a', {
      regex: /@test/g,
      transform: (m) => ({ v: m[0] })
    })
    const pluginB = createRegexMatcher<{ v: string }, 'b'>('b', {
      regex: /@test/g,
      transform: (m) => ({ v: m[0] })
    })

    // Both match @test at exact same range - first matcher (a) should win
    const matches = scan('@test', [pluginA, pluginB])
    expect(matches.map((m) => `${m.matcher}:${m.raw}`)).toEqual(['a:@test'])
  })

  it('scan preserves non-overlapping matches from multiple matchers', () => {
    const mention = createRegexMatcher<{ v: string }, 'mention'>('mention', {
      regex: /@\w+/g,
      transform: (m) => ({ v: m[0] })
    })
    const hashtag = createRegexMatcher<{ v: string }, 'hashtag'>('hashtag', {
      regex: /#\w+/g,
      transform: (m) => ({ v: m[0] })
    })

    // @bob and #music don't overlap, both should be kept
    const matches = scan('@bob loves #music', [mention, hashtag])
    expect(matches.map((m) => `${m.matcher}:${m.raw}`)).toEqual([
      'mention:@bob',
      'hashtag:#music'
    ])
  })
})
