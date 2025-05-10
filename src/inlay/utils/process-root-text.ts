import * as React from 'react'

export function processRootText<T>(
  wholeTextToParse: string,
  currentTokens: Readonly<T[]>,
  parseTokenFunc: (value: string) => T | null,
  savedCursorRefForUpdate: React.MutableRefObject<{
    index: number
    offset: number
  } | null>
): T[] | null {
  if (wholeTextToParse.trim() === '') {
    if (currentTokens.length === 0) return null
    savedCursorRefForUpdate.current = null
    return []
  } else {
    const parsedFallbackToken = parseTokenFunc(wholeTextToParse)
    if (parsedFallbackToken !== null) {
      if (
        currentTokens.length === 1 &&
        JSON.stringify(currentTokens[0]) === JSON.stringify(parsedFallbackToken)
      )
        return null
      if (!savedCursorRefForUpdate.current) {
        savedCursorRefForUpdate.current = {
          index: 0,
          offset: wholeTextToParse.length
        }
      }
      return [parsedFallbackToken]
    } else {
      if (currentTokens.length === 0) return null
      savedCursorRefForUpdate.current = null
      return []
    }
  }
}
