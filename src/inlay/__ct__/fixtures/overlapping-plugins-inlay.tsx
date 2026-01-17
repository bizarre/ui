import React from 'react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

/**
 * Plugin A: matches @test exactly
 * Uses DIVERGED rendering: raw "@test" → visual "[A:test]"
 */
type PluginAData = { raw: string }

function createPluginA(): Plugin<object, PluginAData, 'pluginA'> {
  return {
    props: {},
    matcher: createRegexMatcher<PluginAData, 'pluginA'>('pluginA', {
      regex: /@test(?!\w)/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="pluginA" data-token-raw={token.raw}>
        [A:test]
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

/**
 * Plugin B: also matches @test exactly (same range as Plugin A)
 * Uses DIVERGED rendering: raw "@test" → visual "[B:test]"
 * For exact-same-substring test: we can tell which plugin won by the visual
 */
type PluginBData = { raw: string }

function createPluginB(): Plugin<object, PluginBData, 'pluginB'> {
  return {
    props: {},
    matcher: createRegexMatcher<PluginBData, 'pluginB'>('pluginB', {
      regex: /@test(?!\w)/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="pluginB" data-token-raw={token.raw}>
        [B:test]
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

/**
 * Plugin Short: matches @alice (shorter pattern)
 * This creates a genuine overlap scenario with Plugin Long
 * Raw "@alice" → visual "[short:alice]"
 */
type ShortData = { raw: string }

function createShortPlugin(): Plugin<object, ShortData, 'short'> {
  return {
    props: {},
    matcher: createRegexMatcher<ShortData, 'short'>('short', {
      // Matches @alice even when followed by more characters
      regex: /@alice/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="short" data-token-raw={token.raw}>
        [short:alice]
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

/**
 * Plugin Long: matches @alice_vip (longer pattern, same start position)
 * This should WIN over Short plugin when both match starting at same position
 * Raw "@alice_vip" → visual "[long:alice_vip]"
 */
type LongData = { raw: string }

function createLongPlugin(): Plugin<object, LongData, 'long'> {
  return {
    props: {},
    matcher: createRegexMatcher<LongData, 'long'>('long', {
      regex: /@alice_vip/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="long" data-token-raw={token.raw}>
        [long:alice_vip]
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

/**
 * Plugin Hashtag: matches #hashtag pattern (for non-overlapping scenarios)
 */
type HashtagData = { raw: string }

function createHashtagPlugin(): Plugin<object, HashtagData, 'hashtag'> {
  return {
    props: {},
    matcher: createRegexMatcher<HashtagData, 'hashtag'>('hashtag', {
      regex: /#\w+/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="hashtag" data-token-raw={token.raw}>
        {token.raw}
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

/**
 * Plugin Mention: matches @username (for non-overlapping scenarios)
 */
type MentionData = { raw: string }

function createMentionPlugin(): Plugin<object, MentionData, 'mention'> {
  return {
    props: {},
    matcher: createRegexMatcher<MentionData, 'mention'>('mention', {
      regex: /@\w+/g,
      transform: (match) => ({ raw: match[0] })
    }),
    render: ({ token }) => (
      <span data-plugin="mention" data-token-raw={token.raw}>
        {token.raw}
      </span>
    ),
    portal: () => null,
    onInsert: () => {},
    onKeyDown: () => false
  }
}

export type OverlapScenario =
  | 'exact-same' // Two plugins match exact same @test - diverged renders let us see which won
  | 'longer-wins' // @alice vs @alice_vip at same start position - longer should win
  | 'non-overlapping' // @bob and #hashtag - both should render

type Props = {
  initial: string
  scenario: OverlapScenario
}

export function OverlappingPluginsInlay({ initial, scenario }: Props) {
  const [value, setValue] = React.useState(initial)

  const plugins = React.useMemo(() => {
    switch (scenario) {
      case 'exact-same':
        // Both plugins match @test at the same range
        // Plugin A renders "[A:test]", Plugin B renders "[B:test]"
        // We can tell which won by the visual output
        return [createPluginA(), createPluginB()] as const
      case 'longer-wins':
        // Short matches "@alice" (6 chars), Long matches "@alice_vip" (10 chars)
        // Both start at the same position, but Long is longer
        // Long should win per longest-match-wins
        return [createShortPlugin(), createLongPlugin()] as const
      case 'non-overlapping':
        // Different patterns that don't overlap
        return [createMentionPlugin(), createHashtagPlugin()] as const
    }
  }, [scenario])

  return (
    <StructuredInlay
      value={value}
      onChange={setValue}
      plugins={plugins}
      data-testid="root"
    />
  )
}
