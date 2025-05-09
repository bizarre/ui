import type { Meta } from '@storybook/react'

import { createInlay } from './inlay'
import * as React from 'react'

const Inlay = createInlay<string>()

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
