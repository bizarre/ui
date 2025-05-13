import * as React from 'react'
import type { InlayHistoryEntry, InlayOperationType } from '../inlay.types' // Assuming InlayHistoryEntry and CaretPosition are here

const MAX_HISTORY_LENGTH = 100 // Configurable limit
const COALESCE_INTERVAL_MS = 2000 // 2 seconds for typing to be considered continuous

export interface UseInlayHistoryReturn<T> {
  /**
   * Initializes or resets the history with the given present state.
   * Typically called on component mount and if external changes require a history reset.
   */
  initializePresent: (
    initialEntry: Omit<InlayHistoryEntry<T>, 'timestamp' | 'operationType'> & {
      operationType?: InlayOperationType
    }
  ) => void
  /**
   * Records a new present state. This action clears the future stack.
   * The previous present state is moved to the past stack.
   */
  setPresent: (
    newEntryData: Omit<InlayHistoryEntry<T>, 'timestamp' | 'operationType'> & {
      operationType: InlayOperationType
    }
  ) => boolean
  /**
   * Moves the present state to the future stack and restores the latest past state as present.
   * Returns the restored state entry, or null if no undo is possible.
   */
  undo: () => InlayHistoryEntry<T> | null
  /**
   * Moves the present state to the past stack and restores the earliest future state as present.
   * Returns the restored state entry, or null if no redo is possible.
   */
  redo: () => InlayHistoryEntry<T> | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void // Clears all history
  getPresentEntryData: () => Omit<InlayHistoryEntry<T>, 'timestamp'> | null
  // For debugging, if needed:
  // getPresentState: () => InlayHistoryEntry<T> | null
}

// Helper function for coalescing condition
function shouldCoalesce<T>(
  newEntry: InlayHistoryEntry<T>,
  currentPresent: InlayHistoryEntry<T> | null
): boolean {
  if (!currentPresent) return false

  return (
    newEntry.operationType === 'typing' &&
    currentPresent.operationType === 'typing' &&
    newEntry.caretState?.index === currentPresent.caretState?.index && // Typing in the same token
    newEntry.timestamp - currentPresent.timestamp < COALESCE_INTERVAL_MS
    // Optionally, add a check to ensure text changes are contiguous for typing
    // e.g., new text is old text + one char, or one char removed from end if backspacing
  )
}

// Helper to compare data fields only
function compareDataOnly(entry1: any, entry2: any): boolean {
  const data1 = {
    tokens: entry1.tokens,
    spacerChars: entry1.spacerChars,
    caretState: entry1.caretState,
    selectAllState: entry1.selectAllState
  }
  const data2 = {
    tokens: entry2.tokens,
    spacerChars: entry2.spacerChars,
    caretState: entry2.caretState,
    selectAllState: entry2.selectAllState
  }
  return JSON.stringify(data1) === JSON.stringify(data2)
}

// Helper to compare data + operationType
function compareDataAndOpType(entry1: any, entry2: any): boolean {
  const dataAndOp1 = {
    tokens: entry1.tokens,
    spacerChars: entry1.spacerChars,
    caretState: entry1.caretState,
    selectAllState: entry1.selectAllState,
    operationType: entry1.operationType
  }
  const dataAndOp2 = {
    tokens: entry2.tokens,
    spacerChars: entry2.spacerChars,
    caretState: entry2.caretState,
    selectAllState: entry2.selectAllState,
    operationType: entry2.operationType
  }
  return JSON.stringify(dataAndOp1) === JSON.stringify(dataAndOp2)
}

export function useInlayHistory<T>(): UseInlayHistoryReturn<T> {
  const [history, setHistory] = React.useState<{
    past: InlayHistoryEntry<T>[]
    present: InlayHistoryEntry<T> | null
    future: InlayHistoryEntry<T>[]
  }>({
    past: [],
    present: null,
    future: []
  })

  const initializePresent = React.useCallback(
    (
      initialEntryData: Omit<
        InlayHistoryEntry<T>,
        'timestamp' | 'operationType'
      > & { operationType?: InlayOperationType }
    ) => {
      const entry: InlayHistoryEntry<T> = {
        ...initialEntryData,
        timestamp: Date.now(),
        operationType: initialEntryData.operationType || 'unknown'
      }
      console.log(
        '[History] Initializing present:',
        JSON.parse(JSON.stringify(entry))
      )
      setHistory({
        past: [],
        present: entry,
        future: []
      })
    },
    []
  )

  const setPresent = React.useCallback(
    (
      newEntryData: Omit<
        InlayHistoryEntry<T>,
        'timestamp' | 'operationType'
      > & { operationType: InlayOperationType }
    ): boolean => {
      const newEntry: InlayHistoryEntry<T> = {
        ...newEntryData,
        timestamp: Date.now()
      }

      const currentPresent = history.present
      let performUpdate = false
      let willCoalesce = false

      console.groupCollapsed(
        `[History] setPresent: Evaluating (op: ${newEntry.operationType})`
      )
      console.log('New entry:', JSON.parse(JSON.stringify(newEntry)))
      if (currentPresent) {
        console.log(
          'Current present:',
          JSON.parse(JSON.stringify(currentPresent))
        )
      } else {
        console.log('Current present: null')
      }

      if (currentPresent) {
        if (shouldCoalesce(newEntry, currentPresent)) {
          console.log('[History] Decision: COALESCE.')
          performUpdate = true
          willCoalesce = true
        } else if (newEntry.operationType === 'unknown') {
          if (compareDataOnly(newEntry, currentPresent)) {
            console.log(
              '[History] Decision: SKIP (new op is unknown, data identical to current).'
            )
            performUpdate = false
          } else {
            console.log(
              '[History] Decision: UPDATE (new op is unknown, data differs).'
            )
            performUpdate = true
          }
        } else {
          // newEntry.operationType is NOT 'unknown' and NOT coalescing
          if (compareDataAndOpType(newEntry, currentPresent)) {
            console.log(
              '[History] Decision: SKIP (specific op, but data & opType identical to current - likely timestamp diff only).'
            )
            performUpdate = false
          } else {
            console.log(
              '[History] Decision: UPDATE (specific op, data or opType differs from current).'
            )
            performUpdate = true
          }
        }
      } else {
        console.log('[History] Decision: UPDATE (no current present).')
        performUpdate = true
      }

      console.groupEnd()

      if (performUpdate) {
        console.log('[History] Calling setHistory to apply update.')
        setHistory((currentInternalState) => {
          const actualCurrentPresentForUpdate = currentInternalState.present
          console.groupCollapsed(
            '[History] setHistory internal updater running'
          )
          console.log(
            'newEntry for update:',
            JSON.parse(JSON.stringify(newEntry))
          )
          console.log(
            'actualCurrentPresentForUpdate:',
            actualCurrentPresentForUpdate
              ? JSON.parse(JSON.stringify(actualCurrentPresentForUpdate))
              : null
          )

          if (willCoalesce) {
            console.log('[History] Updater: COALESCING.')
            const coalescedState = {
              ...currentInternalState,
              present: {
                ...newEntry,
                timestamp:
                  actualCurrentPresentForUpdate?.timestamp ?? newEntry.timestamp
                // operationType: 'typing', // No longer explicitly overriding, newEntry has it
              },
              future: []
            }
            console.groupEnd()
            return coalescedState
          } else {
            console.log('[History] Updater: PUSHING to past.')
            const newPast = actualCurrentPresentForUpdate
              ? [...currentInternalState.past, actualCurrentPresentForUpdate]
              : currentInternalState.past
            if (newPast.length > MAX_HISTORY_LENGTH) {
              newPast.shift()
            }
            const pushedState = {
              past: newPast,
              present: newEntry, // newEntry already has the correct operationType from newEntryData
              future: []
            }
            console.log(
              '[History] Updater: Past len:',
              pushedState.past.length,
              'Future len:',
              pushedState.future.length
            )
            console.groupEnd()
            return pushedState
          }
        })
      } else {
        console.log('[History] Skipping setHistory call based on pre-check.')
      }
      return performUpdate
    },
    [history]
  )

  const undo = (): InlayHistoryEntry<T> | null => {
    if (!history.present || history.past.length === 0) {
      console.log('[History] UNDO: Cannot undo (no past or no present).')
      return null
    }

    const entryToRestore = history.past[history.past.length - 1]
    if (entryToRestore) {
      console.log(
        '[History] UNDO: Identified entry to restore from past:',
        JSON.parse(JSON.stringify(entryToRestore))
      )
    }

    setHistory((current) => {
      if (!current.present || current.past.length === 0) {
        // Re-check inside updater for safety
        console.log(
          '[History] UNDO (updater): Condition no longer met, bailing.'
        )
        return current
      }
      const actualEntryToRestore = current.past[current.past.length - 1]
      const newPast = current.past.slice(0, current.past.length - 1)
      const newState = {
        past: newPast,
        present: actualEntryToRestore,
        future: [current.present, ...current.future].slice(
          0,
          MAX_HISTORY_LENGTH
        )
      }
      console.log(
        '[History] UNDO (updater): State updated. New Past len:',
        newState.past.length,
        'New Future len:',
        newState.future.length
      )
      return newState
    })

    return entryToRestore // Return the entry identified before setHistory was called
  }

  const redo = (): InlayHistoryEntry<T> | null => {
    if (!history.present || history.future.length === 0) {
      console.log('[History] REDO: Cannot redo (no future or no present).')
      return null
    }

    const entryToRestore = history.future[0]
    if (entryToRestore) {
      console.log(
        '[History] REDO: Identified entry to restore from future:',
        JSON.parse(JSON.stringify(entryToRestore))
      )
    }

    setHistory((current) => {
      if (!current.present || current.future.length === 0) {
        // Re-check inside updater for safety
        console.log(
          '[History] REDO (updater): Condition no longer met, bailing.'
        )
        return current
      }
      const actualEntryToRestore = current.future[0]
      const newFuture = current.future.slice(1)
      const newState = {
        past: [...current.past, current.present].slice(-MAX_HISTORY_LENGTH),
        present: actualEntryToRestore,
        future: newFuture
      }
      console.log(
        '[History] REDO (updater): State updated. New Past len:',
        newState.past.length,
        'New Future len:',
        newState.future.length
      )
      return newState
    })

    return entryToRestore // Return the entry identified before setHistory was called
  }

  const clear = React.useCallback(() => {
    console.log('[History] Clearing history.')
    setHistory((current) => ({
      past: [],
      present: current.present,
      future: []
    }))
  }, [])

  // Added getPresentEntryData function
  const getPresentEntryData = React.useCallback((): Omit<
    InlayHistoryEntry<T>,
    'timestamp'
  > | null => {
    if (!history.present) return null
    const { timestamp, ...data } = history.present // eslint-disable-line @typescript-eslint/no-unused-vars
    return data
  }, [history.present])

  // const getPresentState = React.useCallback(() => history.present, [history.present])

  return {
    initializePresent,
    setPresent,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clear,
    getPresentEntryData // Expose new function
    // getPresentState
  }
}
