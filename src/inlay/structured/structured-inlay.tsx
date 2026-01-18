/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Base from '../inlay'
import type { InlayRef } from '../inlay'
import type { Plugin } from './plugins/plugin'
import type { Match } from '../internal/string-utils'
import { scan } from '../internal/string-utils'
import { getAbsoluteOffset } from '../internal/dom-utils'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import { flushSync } from 'react-dom'
import React from 'react'

type StructuredInlayProps<T extends readonly Plugin<any, any, any>[]> = {
  plugins?: T
  portalProps?: Omit<React.ComponentProps<typeof Base.Portal>, 'children'>
  portalAnchor?: 'selection' | 'root'
  getPortalAnchorRect?: (root: HTMLDivElement | null) => DOMRect
} & Omit<React.ComponentProps<typeof Base.Root>, 'children'> & {
    children?: React.ReactNode
  }

export const StructuredInlay = <
  const T extends readonly Plugin<any, any, any>[]
>({
  value: valueProp,
  defaultValue,
  onChange: onChangeProp,
  plugins = [] as unknown as T,
  portalProps,
  portalAnchor = 'selection',
  getPortalAnchorRect,
  ...rest
}: StructuredInlayProps<T>) => {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? '',
    onChange: onChangeProp
  })

  const rootRef = React.useRef<InlayRef | null>(null)

  // Stable token ids for metadata and render keys
  type LiveToken = Match<any> & { id: string }
  const [liveTokens, setLiveTokens] = React.useState<LiveToken[]>([])
  const idCounterRef = React.useRef(0)
  const nextId = React.useCallback(() => `tok_${++idCounterRef.current}`, [])

  // Keep plugins in a ref to avoid re-running the effect when the array reference changes
  // (common when plugins are passed inline as an array literal)
  const pluginsRef = React.useRef(plugins)
  pluginsRef.current = plugins

  // Sync live token metadata with current value; preserve metadata where possible
  React.useEffect(() => {
    const newValue = value ?? ''
    const currentPlugins = pluginsRef.current
    const matchers = currentPlugins.map((p) => p.matcher) as any
    const newMatches = scan(newValue, matchers)

    setLiveTokens((currentTokens) => {
      // Build groups of OLD tokens keyed by matcher+raw, sorted by start
      type Group = { list: LiveToken[]; starts: number[]; used: boolean[] }
      const oldGroups = new Map<string, Group>()
      const makeKey = (m: Match<any>) => `${m.matcher}__SEP__${m.raw}`

      const byStart = (a: { start: number }, b: { start: number }) =>
        a.start - b.start
      const lowerBound = (arr: number[], target: number) => {
        let lo = 0,
          hi = arr.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (arr[mid] < target) lo = mid + 1
          else hi = mid
        }
        return lo
      }

      for (const old of currentTokens) {
        const key = makeKey(old)
        let g = oldGroups.get(key)
        if (!g) {
          g = { list: [], starts: [], used: [] }
          oldGroups.set(key, g)
        }
        g.list.push(old)
      }
      for (const g of oldGroups.values()) {
        g.list.sort(byStart)
        g.starts = g.list.map((t) => t.start)
        g.used = new Array(g.list.length).fill(false)
      }

      // For each NEW match, find nearest unused OLD in the same group and adopt its id
      const updatedTokens: LiveToken[] = []
      for (const nm of newMatches) {
        const key = makeKey(nm)
        const g = oldGroups.get(key)
        if (!g || g.list.length === 0) {
          updatedTokens.push({ ...nm, id: nextId() })
          continue
        }

        const idx = lowerBound(g.starts, nm.start)
        let bestIdx = -1
        let bestDist = Number.POSITIVE_INFINITY

        // expand left to nearest unused
        let l = idx - 1
        while (l >= 0) {
          if (!g.used[l]) {
            const d = Math.abs(nm.start - g.starts[l])
            bestIdx = l
            bestDist = d
            break
          }
          l--
        }
        // expand right to nearest unused
        let r = idx
        while (r < g.list.length) {
          if (!g.used[r]) {
            const d = Math.abs(nm.start - g.starts[r])
            if (d < bestDist) {
              bestIdx = r
              bestDist = d
            }
            break
          }
          r++
        }

        if (bestIdx !== -1) {
          g.used[bestIdx] = true
          const oldMatch = g.list[bestIdx]
          updatedTokens.push({
            ...nm,
            id: oldMatch.id,
            // Reuse the data object reference to maintain stable identity for consumers
            data: oldMatch.data
          })
        } else {
          updatedTokens.push({ ...nm, id: nextId() })
        }
      }

      return updatedTokens
    })
  }, [value, nextId])

  const replaceToken = React.useCallback(
    (tokenToReplace: LiveToken, newText: string) => {
      const targetCaret = tokenToReplace.start + newText.length

      flushSync(() => {
        setValue((currentValue: any) => {
          if (!currentValue) return ''
          const before = currentValue.slice(0, tokenToReplace.start)
          const after = currentValue.slice(tokenToReplace.end)
          return `${before}${newText}${after}`
        })
      })

      // Set selection immediately to avoid a visible intermediate frame
      const rootImmediate = rootRef.current?.root
      if (rootImmediate && document.activeElement === rootImmediate) {
        rootRef.current?.setSelection(targetCaret)
      }

      // After the value update and DOM commit, restore caret safely again
      const restore = () => {
        const root = rootRef.current?.root
        const isFocused = document.activeElement === root
        if (root && isFocused) {
          rootRef.current?.setSelection(targetCaret)
        }
      }
      requestAnimationFrame(restore)
    },
    [setValue]
  )

  // Batched update queue to avoid max update depth with many simultaneous updates
  const pendingUpdatesRef = React.useRef<Map<string, any>>(new Map())
  const pendingSelectionRef = React.useRef<{
    start: number
    end: number
  } | null>(null)
  const flushTimeoutRef = React.useRef<number | null>(null)

  const flushPendingUpdates = React.useCallback(() => {
    flushTimeoutRef.current = null
    const updates = pendingUpdatesRef.current
    if (updates.size === 0) return

    const capturedSelection = pendingSelectionRef.current
    pendingUpdatesRef.current = new Map()
    pendingSelectionRef.current = null

    flushSync(() => {
      setLiveTokens((currentTokens) =>
        currentTokens.map((token) => {
          const newData = updates.get(token.id)
          if (newData !== undefined) {
            return {
              ...token,
              data: { ...(token.data as any), ...newData }
            }
          }
          return token
        })
      )
    })

    if (capturedSelection) {
      const { start, end } = capturedSelection
      const rootImmediate = rootRef.current?.root
      if (rootImmediate && document.activeElement === rootImmediate) {
        rootRef.current?.setSelection(start, end)
      }
      requestAnimationFrame(() => {
        const root = rootRef.current?.root
        const isFocused = document.activeElement === root
        if (root && isFocused) {
          rootRef.current?.setSelection(start, end)
        }
      })
    }
  }, [])

  // Update a token by ID - queues update and flushes once per frame
  const updateTokenById = React.useCallback(
    (tokenId: string, newData: any) => {
      // Capture selection ONCE at start of batch
      if (pendingSelectionRef.current === null) {
        const rootEl = rootRef.current?.root
        if (rootEl) {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            if (rootEl.contains(range.startContainer)) {
              const start = getAbsoluteOffset(
                rootEl,
                range.startContainer,
                range.startOffset
              )
              const end = getAbsoluteOffset(
                rootEl,
                range.endContainer,
                range.endOffset
              )
              pendingSelectionRef.current = { start, end }
            }
          }
        }
      }

      // Queue the update
      pendingUpdatesRef.current.set(tokenId, newData)

      // Debounce: reset timer on each update, flush after updates stop for 16ms
      // This batches updates that arrive across multiple event loop cycles
      if (flushTimeoutRef.current !== null) {
        clearTimeout(flushTimeoutRef.current)
      }
      flushTimeoutRef.current = window.setTimeout(flushPendingUpdates, 16)
    },
    [flushPendingUpdates]
  )

  // Cache of stable update functions per token ID
  const updateFunctionsRef = React.useRef(
    new Map<string, (newData: any) => void>()
  )

  // Get or create a stable update function for a token ID
  const getUpdateFunction = React.useCallback(
    (tokenId: string) => {
      let fn = updateFunctionsRef.current.get(tokenId)
      if (!fn) {
        fn = (newData: any) => updateTokenById(tokenId, newData)
        updateFunctionsRef.current.set(tokenId, fn)
      }
      return fn
    },
    [updateTokenById]
  )

  // Clean up stale update functions when tokens change
  React.useEffect(() => {
    const currentIds = new Set(liveTokens.map((t) => t.id))
    for (const id of updateFunctionsRef.current.keys()) {
      if (!currentIds.has(id)) {
        updateFunctionsRef.current.delete(id)
      }
    }
  }, [liveTokens])

  const tokenChildren = liveTokens
    .map((match) => {
      const plugin = pluginsRef.current.find(
        (p) => p.matcher.name === match.matcher
      )
      if (!plugin) return null

      return (
        <Base.Token
          key={match.id}
          value={match.raw}
          data-token-matcher={match.matcher}
          data-token-id={match.id}
        >
          {plugin.render({
            token: match.data as any,
            update: getUpdateFunction(match.id)
          })}
        </Base.Token>
      )
    })
    .filter(Boolean)

  return (
    <Base.Root
      ref={rootRef}
      value={value}
      onChange={setValue}
      getPopoverAnchorRect={
        getPortalAnchorRect
          ? getPortalAnchorRect
          : portalAnchor === 'root'
            ? (root) => {
                if (!root) return new DOMRect(0, 0, 0, 0)
                const r = root.getBoundingClientRect()
                return new DOMRect(r.left, r.bottom, 0, 0)
              }
            : undefined
      }
      {...rest}
    >
      {tokenChildren}
      <Base.Portal {...portalProps}>
        {({ activeToken, activeTokenState }) => {
          if (!activeToken || !activeTokenState) return null

          const activePlugin = pluginsRef.current.find(
            (p) =>
              p.matcher.name ===
              (activeToken.node.props as any)['data-token-matcher']
          )

          if (!activePlugin) return null

          // Map the active raw range to our live token by start/end (id is not available in props reliably)
          const activeMatch = liveTokens.find(
            (m) => m.start === activeToken.start && m.end === activeToken.end
          )

          if (!activeMatch) return null

          return activePlugin.portal({
            token: activeMatch.data as any,
            state: activeTokenState,
            replace: (newText: string) => replaceToken(activeMatch, newText),
            update: getUpdateFunction(activeMatch.id)
          })
        }}
      </Base.Portal>
    </Base.Root>
  )
}
