import type { Plugin } from './plugin'
import { createRegexMatcher } from '../../internal/string-utils'
import { TokenState } from '../../inlay'
import type React from 'react'

type MentionData = {
  mention: string
  name?: string
  avatar?: string
}

type MentionPluginProps = {
  symbol?: string | string[]
  render: (context: {
    token: MentionData
    update: (newData: Partial<MentionData>) => void
  }) => React.ReactNode
  portal: (context: {
    token: MentionData
    state: TokenState
    replace: (newText: string) => void
    update: (newData: Partial<MentionData>) => void
  }) => React.ReactNode
}

export function mentions(
  props: MentionPluginProps
): Plugin<MentionPluginProps, MentionData, 'mention'> {
  const { symbol = '@' } = props
  const symbols = Array.isArray(symbol) ? symbol : [symbol]
  // Escape symbols for regex and join with '|'
  const pattern = symbols
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const matcher = createRegexMatcher<MentionData, 'mention'>('mention', {
    // Match symbol, then any word characters. Must be preceded by a non-word character or be at the start of the string.
    regex: new RegExp(`(?<!\\w)(${pattern})\\w+`, 'g'),
    transform: (match) => ({ mention: match[0] })
  })

  return {
    props,
    matcher,
    render: props.render,
    portal: props.portal,
    onInsert: (): void => {
      // no-op by default
    },
    onKeyDown: () => {
      return false
    }
  }
}
