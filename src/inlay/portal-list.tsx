import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

// --- Portal List Navigation Context ---

type PortalListContextValue<T = unknown> = {
  activeIndex: number
  setActiveIndex: (index: number) => void
  registerItem: (value: T, disabled?: boolean) => number
  unregisterItem: (index: number) => void
  selectItem: (index: number) => void
  loop: boolean
}

const PortalListContext = createContext<PortalListContextValue | null>(null)

function usePortalListContext() {
  const context = useContext(PortalListContext)
  if (!context) {
    throw new Error('Portal.Item must be used within Portal.List')
  }
  return context
}

// --- Keyboard Handler Context ---
// This context allows the parent Inlay.Root to intercept keyboard events

export type PortalKeyboardHandler = (
  event: React.KeyboardEvent<HTMLDivElement>
) => boolean

// Import the context from inlay.tsx to avoid circular dependency issues
// The context is created in inlay.tsx and exported
import { PortalKeyboardContext } from './inlay'

export function usePortalKeyboardContext() {
  return useContext(PortalKeyboardContext)
}

// --- Portal.List Component ---

export type PortalListProps<T> = {
  children: React.ReactNode
  onSelect: (item: T, index: number) => void
  onDismiss?: () => void
  loop?: boolean
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'>

function PortalListInner<T>(
  props: PortalListProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const { children, onSelect, onDismiss, loop = true, ...divProps } = props

  const [activeIndex, setActiveIndex] = useState(0)
  const itemsRef = useRef<Array<{ value: T; disabled?: boolean }>>([])
  const [, forceUpdate] = useState(0)
  const keyboardContext = usePortalKeyboardContext()

  const registerItem = useCallback((value: T, disabled?: boolean) => {
    const index = itemsRef.current.length
    itemsRef.current.push({ value, disabled })
    forceUpdate((n) => n + 1)
    return index
  }, [])

  const unregisterItem = useCallback((index: number) => {
    itemsRef.current.splice(index, 1)
    forceUpdate((n) => n + 1)
  }, [])

  const selectItem = useCallback(
    (index: number) => {
      const item = itemsRef.current[index]
      if (item && !item.disabled) {
        onSelect(item.value, index)
      }
    },
    [onSelect]
  )

  const navigateUp = useCallback(() => {
    const items = itemsRef.current
    if (items.length === 0) return

    setActiveIndex((current) => {
      let nextIndex = current - 1
      if (nextIndex < 0) {
        nextIndex = loop ? items.length - 1 : 0
      }

      // Skip disabled items
      let attempts = 0
      while (items[nextIndex]?.disabled && attempts < items.length) {
        nextIndex = nextIndex - 1
        if (nextIndex < 0) {
          nextIndex = loop ? items.length - 1 : 0
        }
        attempts++
      }

      return nextIndex
    })
  }, [loop])

  const navigateDown = useCallback(() => {
    const items = itemsRef.current
    if (items.length === 0) return

    setActiveIndex((current) => {
      let nextIndex = current + 1
      if (nextIndex >= items.length) {
        nextIndex = loop ? 0 : items.length - 1
      }

      // Skip disabled items
      let attempts = 0
      while (items[nextIndex]?.disabled && attempts < items.length) {
        nextIndex = nextIndex + 1
        if (nextIndex >= items.length) {
          nextIndex = loop ? 0 : items.length - 1
        }
        attempts++
      }

      return nextIndex
    })
  }, [loop])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): boolean => {
      const items = itemsRef.current

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          navigateUp()
          return true
        case 'ArrowDown':
          event.preventDefault()
          navigateDown()
          return true
        case 'Enter': {
          const item = items[activeIndex]
          if (item && !item.disabled) {
            event.preventDefault()
            onSelect(item.value, activeIndex)
            return true
          }
          return false
        }
        case 'Escape':
          event.preventDefault()
          onDismiss?.()
          return true
        default:
          return false
      }
    },
    [activeIndex, navigateUp, navigateDown, onSelect, onDismiss]
  )

  // Register keyboard handler with parent context
  useLayoutEffect(() => {
    keyboardContext?.setHandler(handleKeyDown)
    return () => {
      keyboardContext?.setHandler(null)
    }
  }, [keyboardContext, handleKeyDown])

  // Reset active index when items change
  useEffect(() => {
    const items = itemsRef.current
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(items.length - 1)
    }
  }, [activeIndex])

  const contextValue = useMemo(
    (): PortalListContextValue<T> => ({
      activeIndex,
      setActiveIndex,
      registerItem,
      unregisterItem,
      selectItem,
      loop
    }),
    [activeIndex, registerItem, unregisterItem, selectItem, loop]
  )

  return (
    <PortalListContext.Provider value={contextValue as PortalListContextValue}>
      <div
        ref={ref}
        role="listbox"
        {...divProps}
        onMouseDown={(e) => {
          e.preventDefault()
          divProps.onMouseDown?.(e)
        }}
      >
        {children}
      </div>
    </PortalListContext.Provider>
  )
}

export const PortalList = React.forwardRef(PortalListInner) as <T>(
  props: PortalListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement

// --- Portal.Item Component ---

export type PortalItemProps<T> = {
  value: T
  disabled?: boolean
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'value'>

function PortalItemInner<T>(
  props: PortalItemProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const { value, disabled = false, children, ...divProps } = props
  const context = usePortalListContext()
  const [index, setIndex] = useState<number>(-1)

  // Register this item on mount
  useLayoutEffect(() => {
    const idx = context.registerItem(value, disabled)
    setIndex(idx)
    return () => {
      context.unregisterItem(idx)
    }
  }, [])

  const isActive = context.activeIndex === index

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!disabled && index >= 0) {
        context.selectItem(index)
      }
      divProps.onClick?.(e)
    },
    [disabled, context, divProps, index]
  )

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!disabled && index >= 0) {
        context.setActiveIndex(index)
      }
      divProps.onMouseEnter?.(e)
    },
    [disabled, context, divProps, index]
  )

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isActive}
      aria-disabled={disabled || undefined}
      data-portal-item=""
      data-active={isActive || undefined}
      data-disabled={disabled || undefined}
      {...divProps}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </div>
  )
}

export const PortalItem = React.forwardRef(PortalItemInner) as <T>(
  props: PortalItemProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement
