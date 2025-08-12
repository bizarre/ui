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

  it('scan sorts by start index across overlapping patterns', () => {
    const atWord = createRegexMatcher<{ v: string }, 'at'>('at', {
      regex: /@\w+/g,
      transform: (m) => ({ v: m[0] })
    })
    const word = createRegexMatcher<{ v: string }, 'word'>('word', {
      regex: /\w+/g,
      transform: (m) => ({ v: m[0] })
    })

    const matches = scan('@alex', [atWord, word])
    expect(matches.map((m) => `${m.matcher}:${m.raw}`)).toEqual([
      'at:@alex',
      'word:alex'
    ])
  })
})
