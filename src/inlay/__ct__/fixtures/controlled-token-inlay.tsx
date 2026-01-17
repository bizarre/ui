import React from 'react'
import { Inlay } from '../..'

export function ControlledTokenInlay({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial)
  return (
    <Inlay.Root value={value} onChange={setValue} data-testid="root">
      {value.includes('@x') ? (
        <Inlay.Token value="@x">
          <span>@x</span>
        </Inlay.Token>
      ) : (
        <span />
      )}
    </Inlay.Root>
  )
}
