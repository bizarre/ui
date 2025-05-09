import type { Meta } from '@storybook/react'

import { createTokenBox } from './tokenbox'
import * as React from 'react'

const TokenBox = createTokenBox<string>()

const meta: Meta<typeof TokenBox.Root> = {
  component: TokenBox.Root
}

export default meta

export const Basic = () => {
  const [tokens, setTokens] = React.useState<string[]>([])
  const [activeTokenIndex, setActiveTokenIndex] = React.useState<number | null>(
    null
  )
  return (
    <>
      <TokenBox.Root
        parseToken={(value) => {
          return value
        }}
        onTokensChange={(tokens) => {
          console.log('onTokensChange', tokens)
          setTokens(tokens)
        }}
        onTokenChange={(index, value) => {
          console.log('onTokenChange', index, value)
        }}
        onTokenFocus={(index) => {
          setActiveTokenIndex(index)
        }}
        style={{
          border: '1px solid black'
        }}
        commitOnChars={['Enter', ' ']}
        displayCommitCharSpacer={true}
        addNewTokenOnCommit={true}
      >
        {tokens.map((token, index) => (
          <TokenBox.Token index={index} editable>
            {token}
          </TokenBox.Token>
        ))}
      </TokenBox.Root>

      <pre>
        {JSON.stringify(
          {
            tokens,
            activeToken:
              activeTokenIndex !== null ? tokens[activeTokenIndex] : undefined
          },
          null,
          2
        )}
      </pre>
    </>
  )
}
