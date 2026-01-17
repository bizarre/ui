import React from 'react'
import { Inlay } from '../../index'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

const ITEMS = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
  { id: '3', label: 'Cherry' }
]

type TokenData = { mention: string; resolved?: boolean }

const mentionMatcher = createRegexMatcher<TokenData, 'mention'>('mention', {
  regex: /@\w+/g, // Use + to require at least one char after @
  transform: (match) => ({ mention: match[0] })
})

/**
 * A fixture for testing Inlay.Portal.List keyboard navigation.
 * Uses Inlay.StructuredInlay with a mention-style plugin.
 */
export function PortalNavigationInlay({
  initial = '',
  onSelect
}: {
  initial?: string
  onSelect?: (item: (typeof ITEMS)[number]) => void
}) {
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null)
  const [rawValue, setRawValue] = React.useState(initial)

  const plugin: Plugin<
    Record<string, never>,
    TokenData,
    'mention'
  > = React.useMemo(
    () => ({
      props: {},
      matcher: mentionMatcher,
      render: ({ token }) => (
        <span style={{ color: 'blue' }} data-testid="token-render">
          {token.mention}
        </span>
      ),
      portal: ({ replace }) => {
        // Always show portal for testing
        return (
          <Inlay.Portal.List
            onSelect={(item: (typeof ITEMS)[number]) => {
              replace(`@${item.id} `)
              setSelectedItem(item.label)
              setRawValue((prev) => prev.replace(/@\w*$/, `@${item.id} `))
              onSelect?.(item)
            }}
            data-testid="portal-list"
            className="portal-list"
          >
            {ITEMS.map((item) => (
              <Inlay.Portal.Item
                key={item.id}
                value={item}
                data-testid={`item-${item.id}`}
                className="portal-item"
              >
                {item.label}
              </Inlay.Portal.Item>
            ))}
          </Inlay.Portal.List>
        )
      },
      onInsert: () => {},
      onKeyDown: () => false
    }),
    [onSelect]
  )

  return (
    <div>
      <Inlay.StructuredInlay
        value={rawValue}
        onChange={setRawValue}
        plugins={[plugin]}
        data-testid="editor"
        aria-label="Test editor"
        portalProps={{ 'data-testid': 'portal' }}
      />
      <div data-testid="selected">{selectedItem || 'none'}</div>
      <div data-testid="raw-value">{rawValue}</div>
    </div>
  )
}
