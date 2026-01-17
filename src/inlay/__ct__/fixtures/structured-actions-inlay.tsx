import React from 'react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

type TokenData = { raw: string; label?: string }

/**
 * Test fixture that exposes replace/update via buttons in the portal for easy testing
 */
export function StructuredActionsInlay({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial)

  const plugins: Plugin<object, TokenData, 'mention'>[] = React.useMemo(
    () => [
      {
        props: {},
        matcher: createRegexMatcher<TokenData, 'mention'>('mention', {
          regex: /@\w+/g,
          transform: (m) => ({ raw: m[0] })
        }),
        render: ({ token }) => (
          <span data-testid="token-render">{token.label ?? token.raw}</span>
        ),
        portal: ({ replace, update }) => {
          return (
            <div data-testid="portal" onMouseDown={(e) => e.preventDefault()}>
              <button
                data-testid="btn-update"
                onClick={() => update({ label: 'UpdatedLabel' })}
              >
                Update
              </button>
              <button
                data-testid="btn-replace"
                onClick={() => replace('@replaced')}
              >
                Replace
              </button>
            </div>
          )
        },
        onInsert: () => {},
        onKeyDown: () => false
      }
    ],
    []
  )

  return (
    <div>
      <StructuredInlay
        value={value}
        onChange={setValue}
        plugins={plugins}
        data-testid="editor"
      />
      <div data-testid="raw-value">{value}</div>
    </div>
  )
}
