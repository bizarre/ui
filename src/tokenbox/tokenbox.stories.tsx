import type { Meta } from '@storybook/react'

import * as TokenBox from './tokenbox'
import * as React from 'react'

const meta: Meta<typeof TokenBox.Root> = {
  component: TokenBox.Root
}

export default meta

export const Basic = () => {
  const [tokens, setTokens] = React.useState<{ [id: string]: string }>({})
  const [activeTokenId, setActiveTokenId] = React.useState<string | null>(null)
  const [value, setValue] = React.useState('')
  return (
    <>
      <TokenBox.Root
        onTokensChange={(tokens) => {
          console.log('onTokensChange', tokens)
          setTokens(tokens)
        }}
        onTokenChange={(id, value) => {
          console.log('onTokenChange', id, value)
        }}
        onTokenFocus={(id) => {
          setActiveTokenId(id)
        }}
        style={{
          border: '1px solid black'
        }}
      >
        {Object.entries(tokens).map(([id, token]) => (
          <TokenBox.Token key={id} id={id} editable>
            {token}
          </TokenBox.Token>
        ))}
        <TokenBox.Buffer
          value={value}
          onChange={(value) => {
            setValue(value)
            console.log('onChange', value)
          }}
        />
      </TokenBox.Root>

      <pre>
        {JSON.stringify(
          {
            value,
            tokens,
            activeToken: activeTokenId ? tokens[activeTokenId] : undefined
          },
          null,
          2
        )}
      </pre>
    </>
  )
}
