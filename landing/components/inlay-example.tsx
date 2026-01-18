import React from 'react'
import { Inlay } from '@lib'
import { mentions } from '../../src/inlay/structured/plugins/mentions'

const colors = {
  bg: '#0A0A0A',
  surface: '#111111',
  surfaceLight: '#1A1A1A',
  border: '#222222',
  borderLight: '#333333',
  text: '#FFFFFF',
  textMuted: '#888888',
  lime: '#B8FF00'
}

const MOCK_USERS = [
  { id: 'alexadewole', name: 'Alex' },
  { id: 'samantha', name: 'Samantha' },
  { id: 'jordan_dev', name: 'Jordan' },
  { id: 'taylor_ui', name: 'Taylor' }
]

const MentionAutocomplete = ({
  query,
  onSelect
}: {
  query: string
  onSelect: (user: { id: string; name: string }) => void
}) => {
  const results = React.useMemo(() => {
    const searchTerm = query.slice(1).toLowerCase()
    return MOCK_USERS.filter(
      (user) =>
        user.name.toLowerCase().includes(searchTerm) ||
        user.id.toLowerCase().includes(searchTerm)
    )
  }, [query])

  if (results.length === 0) {
    return (
      <div
        className="rounded-lg p-2 text-sm w-48 shadow-2xl"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`
        }}
      >
        <div className="p-2 text-xs" style={{ color: colors.textMuted }}>
          No users found
        </div>
      </div>
    )
  }

  return (
    <Inlay.Portal.List
      onSelect={(user: (typeof MOCK_USERS)[number]) => onSelect(user)}
      className="rounded-lg p-1.5 text-sm w-48 shadow-2xl"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`
      }}
    >
      {results.map((user) => (
        <Inlay.Portal.Item
          key={user.id}
          value={user}
          className="px-3 py-2 rounded-md cursor-pointer transition-colors text-sm data-[active]:bg-[#B8FF0015]"
          style={{ color: colors.text }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium"
              style={{
                backgroundColor: `${colors.lime}20`,
                color: colors.lime
              }}
            >
              {user.name[0]}
            </div>
            <div className="flex flex-col">
              <span style={{ color: colors.text }}>{user.name}</span>
              <span className="text-[10px]" style={{ color: colors.textMuted }}>
                @{user.id}
              </span>
            </div>
          </div>
        </Inlay.Portal.Item>
      ))}
    </Inlay.Portal.List>
  )
}

const MentionToken = ({
  token,
  update
}: {
  token: { mention: string; name?: string }
  update: (data: Partial<{ mention: string; name?: string }>) => void
}) => {
  React.useEffect(() => {
    if (token.mention.startsWith('@') && !token.name) {
      const timeout = setTimeout(() => {
        const id = token.mention.slice(1)
        const user = MOCK_USERS.find((u) => u.id === id)
        if (user) {
          update({ name: user.name })
        }
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [token.mention, token.name, update])

  if (token.name) {
    return (
      <span
        className="font-medium rounded px-1.5 py-0.5"
        style={{ backgroundColor: `${colors.lime}20`, color: colors.lime }}
      >
        {token.name}
      </span>
    )
  }
  return <span style={{ color: colors.lime }}>{token.mention}</span>
}

export default function InlayExample() {
  return (
    <div
      className="rounded-lg overflow-hidden w-full max-w-full"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`
      }}
    >
      <Inlay.StructuredInlay
        multiline={false}
        defaultValue="check this out @alexadewole"
        plugins={[
          mentions({
            render: ({ token, update }) => (
              <MentionToken token={token} update={update} />
            ),
            portal: ({ token, replace }) => {
              if (token.name) return null

              return (
                <MentionAutocomplete
                  query={token.mention}
                  onSelect={(user) => {
                    replace(`@${user.id} `)
                  }}
                />
              )
            }
          })
        ]}
        placeholder="Type @ to mention someone..."
        className="w-full text-sm p-4 focus:outline-none overflow-hidden text-ellipsis"
        style={{ color: colors.text }}
        portalProps={{
          align: 'start',
          side: 'bottom',
          alignOffset: -5,
          sideOffset: 8
        }}
      />
    </div>
  )
}
