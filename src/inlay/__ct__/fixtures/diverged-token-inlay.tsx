import React from 'react'
import { Inlay } from '../..'

/**
 * A fixture with a "diverged" token where the visual display
 * differs from the raw value:
 * - Raw value: "@alice" (7 chars)
 * - Visual display: "Alice" (5 chars)
 */
export function DivergedTokenInlay({
  initial,
  onValueChange
}: {
  initial: string
  onValueChange?: (value: string) => void
}) {
  const [value, setValue] = React.useState(initial)

  const handleChange = (newValue: string) => {
    setValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <Inlay.Root value={value} onChange={handleChange} data-testid="root">
      {value.includes('@alice') ? (
        <Inlay.Token value="@alice" data-testid="token">
          <span style={{ color: 'blue', fontWeight: 'bold' }}>Alice</span>
        </Inlay.Token>
      ) : (
        <span />
      )}
    </Inlay.Root>
  )
}
