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
          border: '1px solid black',
          display: 'flex',
          outline: 'none'
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
            <Inlay.EditableText value={token} index={index} />
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
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  // const updateToken = (index: number, value: Token) => {
  //   setValue((prev) => {
  //     const newTokens = [...prev]
  //     newTokens[index] = value
  //     return newTokens
  //   })
  // }

  return (
    <>
      <MentionInlay.Root
        data-testid="inlay__root"
        parse={(value) => {
          if (value.startsWith('@')) {
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
        value={value}
        onFocus={setActiveIndex}
        className="flex items-center border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-300 p-1.5 leading-none"
        commitOnChars={[' ']}
        displayCommitCharSpacer
        addNewTokenOnCommit
        insertSpacerOnCommit
      >
        {value.map((token, index) => (
          <MentionInlay.Token key={index} index={index} editable>
            {typeof token === 'string' ? (
              <MentionInlay.EditableText
                className="h-4"
                value={token}
                index={index}
              />
            ) : (
              <>
                <div className="relative inline">
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

                  {activeIndex === index && (
                    <div className="absolute top-5 left-0 bg-red-500 w-full min-w-[250px]">
                      Testing
                    </div>
                  )}
                </div>
              </>
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
