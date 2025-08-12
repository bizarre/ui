import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

export type TokenState = {
  isCollapsed: boolean
  isAtStartOfToken: boolean
  isAtEndOfToken: boolean
}

export type TokenInfo = {
  text: string
  node: React.ReactElement
  start: number
  end: number
}

export function useTokenWeaver(
  value: string,
  selection: { start: number; end: number },
  multiline: boolean,
  children: React.ReactNode
) {
  const [isRegistered, setIsRegistered] = useState(false)
  const tokenRegistry = useRef<{ text: string; node: React.ReactElement }[]>([])
  const activeTokenRef = useRef<TokenInfo | null>(null)

  if (!isRegistered) tokenRegistry.current = []

  const registerToken = useCallback(
    (token: { text: string; node: React.ReactElement }) => {
      tokenRegistry.current.push(token)
    },
    []
  )

  useLayoutEffect(() => {
    setIsRegistered(false)
  }, [children])

  useLayoutEffect(() => {
    if (!isRegistered) setIsRegistered(true)
  }, [isRegistered])

  const { weavedChildren, activeToken, activeTokenState } = useMemo(() => {
    if (!isRegistered) {
      return {
        weavedChildren: null as React.ReactNode,
        activeToken: activeTokenRef.current,
        activeTokenState: null as TokenState | null
      }
    }

    const isStale = tokenRegistry.current.some(
      (token) => value.indexOf(token.text) === -1
    )
    if (isStale) {
      return {
        weavedChildren: null as React.ReactNode,
        activeToken: activeTokenRef.current,
        activeTokenState: null as TokenState | null
      }
    }

    // Robust sorting to handle duplicate tokens
    const sortedTokens: { text: string; node: React.ReactElement }[] = []
    const tokenPool = [...tokenRegistry.current]
    let searchIndex = 0
    while (searchIndex < value.length && tokenPool.length > 0) {
      let foundToken = false
      for (let i = 0; i < tokenPool.length; i++) {
        const token = tokenPool[i]
        if (value.startsWith(token.text, searchIndex)) {
          sortedTokens.push(token)
          tokenPool.splice(i, 1)
          searchIndex += token.text.length
          foundToken = true
          break
        }
      }
      if (!foundToken) searchIndex++
    }

    const result: React.ReactNode[] = []
    const map: TokenInfo[] = []
    let currentIndex = 0
    if (sortedTokens.length === 0) {
      const nodes: React.ReactNode[] = [<span key="full-text">{value}</span>]
      if (multiline && value.endsWith('\n'))
        nodes.push(<br key="trailing-br" />)
      const tokenMap = [
        { text: value, node: <span />, start: 0, end: value.length }
      ]
      const active =
        tokenMap.find(
          (t) => selection.start >= t.start && selection.end <= t.end
        ) || null
      return {
        weavedChildren: nodes,
        activeToken: active,
        activeTokenState: null as TokenState | null
      }
    }

    for (const token of sortedTokens) {
      const tokenStartIndex = value.indexOf(token.text, currentIndex)
      if (tokenStartIndex === -1) continue
      if (tokenStartIndex > currentIndex) {
        const spacerText = value.slice(currentIndex, tokenStartIndex)
        result.push(<span key={`spacer-${currentIndex}`}>{spacerText}</span>)
        map.push({
          text: spacerText,
          node: <span />,
          start: currentIndex,
          end: tokenStartIndex
        })
      }
      const tokenWithKey = React.cloneElement(token.node, {
        key: `token-${currentIndex}`
      })
      result.push(tokenWithKey)
      map.push({
        text: token.text,
        node: token.node,
        start: tokenStartIndex,
        end: tokenStartIndex + token.text.length
      })
      currentIndex = tokenStartIndex + token.text.length
    }

    if (currentIndex < value.length) {
      const trailingSpacer = value.slice(currentIndex)
      result.push(<span key="spacer-trailing">{trailingSpacer}</span>)
      map.push({
        text: trailingSpacer,
        node: <span />,
        start: currentIndex,
        end: value.length
      })
    }

    if (multiline && value.endsWith('\n')) {
      result.push(<br key="trailing-br" />)
    }

    const active =
      map.find((t) => selection.start >= t.start && selection.end <= t.end) ||
      null

    let activeTokenState: TokenState | null = null
    if (active) {
      const isCollapsed = selection.start === selection.end
      activeTokenState = {
        isCollapsed,
        isAtStartOfToken: isCollapsed && selection.start === active.start,
        isAtEndOfToken: isCollapsed && selection.end === active.end
      }
    }

    activeTokenRef.current = active

    return { weavedChildren: result, activeToken: active, activeTokenState }
  }, [value, isRegistered, selection, multiline])

  return {
    isRegistered,
    setIsRegistered,
    registerToken,
    weavedChildren,
    activeToken,
    activeTokenRef,
    activeTokenState
  }
}
