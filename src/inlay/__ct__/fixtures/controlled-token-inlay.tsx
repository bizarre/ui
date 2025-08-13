import React from 'react'
import { Root as Inlay, Token } from '../..'

export function ControlledTokenInlay({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial)
  return (
    <Inlay value={value} onChange={setValue} data-testid="root">
      {value.includes('@x') ? (
        <Token value="@x">
          <span>@x</span>
        </Token>
      ) : (
        <span />
      )}
    </Inlay>
  )
}
