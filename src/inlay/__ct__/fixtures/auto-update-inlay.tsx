import React from 'react'
import { StructuredInlay } from '../../structured/structured-inlay'
import { createRegexMatcher } from '../../internal/string-utils'
import type { Plugin } from '../../structured/plugins/plugin'

type TokenData = { raw: string; name?: string }

/**
 * Token component that auto-updates after mount (like the storybook MentionToken).
 * This creates divergence: raw "@user" → display "User Name"
 */
function MentionToken({
  token,
  update
}: {
  token: TokenData
  update: (data: Partial<TokenData>) => void
}) {
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    // Only run in the visible render (not the hidden registration pass)
    // Check if we're inside a display:none container
    if (ref.current && ref.current.offsetParent === null) {
      return
    }

    // If no name yet, "fetch" and update (simulates async user lookup)
    if (!token.name && token.raw.startsWith('@')) {
      const timeout = setTimeout(() => {
        update({ name: 'User Name' })
      }, 10)
      return () => clearTimeout(timeout)
    }
  }, [token.raw, token.name, update])

  return (
    <span ref={ref} data-testid="token-render">
      {token.name ?? token.raw}
    </span>
  )
}

/**
 * Test fixture with auto-updating diverged tokens.
 * Each @mention triggers an update() call after mount.
 */
export function AutoUpdateInlay({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial)

  const plugins: Plugin<object, TokenData, 'mention'>[] = React.useMemo(
    () => [
      {
        props: {},
        matcher: createRegexMatcher<TokenData, 'mention'>('mention', {
          regex: /@\w+/g,
          transform: (m) => ({ raw: m[0] })
        }),
        render: ({ token, update }) => (
          <MentionToken token={token} update={update} />
        ),
        portal: () => null,
        onInsert: () => {},
        onKeyDown: () => false
      }
    ],
    []
  )

  return (
    <StructuredInlay
      value={value}
      onChange={setValue}
      plugins={plugins}
      data-testid="editor"
    />
  )
}
