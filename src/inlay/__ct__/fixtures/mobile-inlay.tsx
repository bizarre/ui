import React from 'react'
import { Inlay } from '../../index'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

const ITEMS = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
  { id: '3', label: 'Cherry' }
]

type TokenData = { mention: string }

const mentionMatcher = createRegexMatcher<TokenData, 'mention'>('mention', {
  regex: /@\w+/g,
  transform: (match) => ({ mention: match[0] })
})

/**
 * A fixture for testing mobile interactions with Inlay.
 * Includes portal for testing touch-based portal navigation.
 */
export function MobileInlay({
  initial = '',
  onSelect,
  onKeyboardChange
}: {
  initial?: string
  onSelect?: (item: (typeof ITEMS)[number]) => void
  onKeyboardChange?: (open: boolean) => void
}) {
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null)
  const [rawValue, setRawValue] = React.useState(initial)
  const [keyboardOpen, setKeyboardOpen] = React.useState(false)

  const handleKeyboardChange = React.useCallback(
    (open: boolean) => {
      setKeyboardOpen(open)
      onKeyboardChange?.(open)
    },
    [onKeyboardChange]
  )

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
        return (
          <Inlay.Portal.List
            onSelect={(item: (typeof ITEMS)[number]) => {
              replace(`@${item.id} `)
              setSelectedItem(item.label)
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
                style={{ padding: '8px', cursor: 'pointer' }}
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
    <div style={{ padding: '20px' }}>
      <Inlay.StructuredInlay
        value={rawValue}
        onChange={setRawValue}
        plugins={[plugin]}
        data-testid="editor"
        aria-label="Mobile test editor"
        portalProps={{ 'data-testid': 'portal' }}
        onVirtualKeyboardChange={handleKeyboardChange}
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          minHeight: '40px'
        }}
      />
      <div data-testid="selected">{selectedItem || 'none'}</div>
      <div data-testid="raw-value">{rawValue}</div>
      <div data-testid="keyboard-state">{keyboardOpen ? 'open' : 'closed'}</div>
    </div>
  )
}

/**
 * Simple fixture for basic mobile touch tests without plugins.
 */
export function SimpleMobileInlay({ initial = '' }: { initial?: string }) {
  const [value, setValue] = React.useState(initial)

  return (
    <div style={{ padding: '20px' }}>
      <Inlay.Root
        value={value}
        onChange={setValue}
        data-testid="editor"
        aria-label="Simple mobile editor"
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          minHeight: '40px'
        }}
      >
        <Inlay.Token value="@user">
          <span style={{ color: 'blue' }}>User</span>
        </Inlay.Token>
      </Inlay.Root>
      <div data-testid="raw-value">{value}</div>
    </div>
  )
}
