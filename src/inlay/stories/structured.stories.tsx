import type { Meta } from '@storybook/react'
import { StructuredInlay } from '../structured/structured-inlay'
import { mentions } from '../structured/plugins/mentions'
import { Portal } from '../inlay'
import React from 'react'

const meta: Meta<typeof StructuredInlay> = {
  title: 'inlay',
  component: StructuredInlay
}

export default meta

const MOCK_USERS = [
  { id: 'alexadewole', name: 'Alex' },
  { id: 'aliciakeys', name: 'Alicia Keys' },
  { id: 'alexanderthegreat', name: 'Alexander The Great' }
]

// This component uses Portal.List/Item for keyboard navigation
const MentionAutocomplete = ({
  query,
  onSelect
}: {
  query: string
  onSelect: (user: { id: string; name: string }) => void
}) => {
  const [results, setResults] = React.useState<typeof MOCK_USERS>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    setIsLoading(true)
    const timeout = setTimeout(() => {
      const filtered = MOCK_USERS.filter((user) =>
        user.name.toLowerCase().includes(query.slice(1).toLowerCase())
      )
      setResults(filtered)
      setIsLoading(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [query])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-2 border text-sm w-48">
        <div className="p-2 text-gray-500">Loading...</div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-2 border text-sm w-48">
        <div className="p-2 text-gray-500">No results</div>
      </div>
    )
  }

  return (
    <Portal.List
      onSelect={(user: (typeof MOCK_USERS)[number]) => onSelect(user)}
      className="bg-white rounded-xl shadow-lg p-2 border text-sm w-48"
    >
      {results.map((user) => (
        <Portal.Item
          key={user.id}
          value={user}
          className="p-2 rounded-md cursor-pointer data-[active]:bg-blue-100"
        >
          {user.name}
        </Portal.Item>
      ))}
    </Portal.List>
  )
}

const MentionToken = ({
  token,
  update
}: {
  token: { mention: string; name?: string; avatar?: string }
  update: (
    data: Partial<{ mention: string; name?: string; avatar?: string }>
  ) => void
}) => {
  React.useEffect(() => {
    // If the token has a canonical ID but not a display name, fetch it.
    if (token.mention.startsWith('@') && !token.name) {
      setTimeout(() => {
        const id = token.mention.slice(1)
        const user = MOCK_USERS.find((u) => u.id === id)
        if (user) {
          update({
            name: user.name,
            avatar: `https://i.pravatar.cc/150?u=${user.id}`
          })
        }
      }, 500)
    }
  }, [token, update])

  if (token.name) {
    return (
      <span className="text-blue-500 font-bold bg-blue-100 rounded-md px-1 py-0.5">
        {token.name}
      </span>
    )
  }
  return <span className="text-blue-500">{token.mention}</span>
}

export const Structured = () => {
  return (
    <div className="bg-gray-100 p-8 flex justify-center min-h-screen items-start">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-4">
        <StructuredInlay
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
          placeholder="Type '@' to mention someone..."
          className="w-full text-base p-2 focus:outline-none"
          portalProps={{
            align: 'start',
            side: 'bottom',
            alignOffset: -5,
            sideOffset: 5
          }}
        />
      </div>
    </div>
  )
}
