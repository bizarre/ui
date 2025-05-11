import type { Meta } from '@storybook/react'

import * as Inlay from './inlay'
import { createInlay, type InferInlay } from './inlay'
import * as React from 'react'

const meta: Meta<typeof Inlay.Root> = {
  component: Inlay.Root
}

export default meta

export const Basic = () => {
  const [value, setValue] = React.useState<string[]>([])
  const [activeTokenIndex, setActiveTokenIndex] = React.useState<number | null>(
    null
  )
  return (
    <>
      <Inlay.Root
        data-testid="inlay__root"
        parse={(value) => {
          return value
        }}
        onChange={(value) => {
          console.log('onChange', value)
          setValue(value)
        }}
        onTokenChange={(index, value) => {
          console.log('onTokenChange', index, value)
        }}
        onFocus={(index) => {
          setActiveTokenIndex(index)
        }}
        style={{
          border: '1px solid black'
        }}
        onInput={(context) => {
          console.log('onInput', context)
        }}
        commitOnChars={[' ']}
        displayCommitCharSpacer
        addNewTokenOnCommit
        insertSpacerOnCommit
      >
        {value.map((token, index) => (
          <Inlay.Token key={index} index={index} editable>
            {token}
          </Inlay.Token>
        ))}
      </Inlay.Root>

      <pre>
        {JSON.stringify(
          {
            value,
            activeToken:
              activeTokenIndex !== null ? value[activeTokenIndex] : undefined
          },
          null,
          2
        )}
      </pre>
    </>
  )
}

const MentionInlay = createInlay<
  | {
      username: string
      avatar: string
    }
  | string
>()

type Token = InferInlay<typeof MentionInlay>

export const Mentions = () => {
  const [value, setValue] = React.useState<Token[]>([])

  return (
    <>
      <MentionInlay.Root
        data-testid="inlay__root"
        parse={(value) => {
          if (value.startsWith('@') && value.length > 1) {
            return {
              username: value.slice(1),
              avatar: 'https://placehold.co/16x16'
            }
          }
          return value
        }}
        onChange={(value) => {
          setValue(value)
        }}
        className="flex items-center p-1.5 border-slate-300 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300"
        commitOnChars={[' ']}
        displayCommitCharSpacer
        addNewTokenOnCommit
        insertSpacerOnCommit
      >
        {value.map((token, index) => (
          <MentionInlay.Token key={index} index={index} editable>
            {typeof token === 'string' ? (
              <MentionInlay.EditableText value={token} index={index} />
            ) : (
              <span className="inline-flex items-center font-semibold">
                <img
                  src={token.avatar}
                  alt={token.username}
                  className="h-4 w-4 rounded-full mr-0.5"
                />
                <MentionInlay.EditableText
                  value={`@${token.username}`}
                  index={index}
                />
              </span>
            )}
          </MentionInlay.Token>
        ))}
      </MentionInlay.Root>

      <pre>
        {JSON.stringify(
          {
            value
          },
          null,
          2
        )}
      </pre>
    </>
  )
}
