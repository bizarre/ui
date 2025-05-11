import * as React from 'react'

/**
 * Custom hook to memoize a callback function, ensuring that the returned callback
 * always executes the latest version of the input callback, while the hook itself
 * returns a stable function instance.
 *
 * @param callback The callback function to memoize.
 * @returns A memoized version of the callback function with a stable reference.
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T | undefined // Allow callback to be undefined
): T {
  const callbackRef = React.useRef(callback)

  React.useEffect(() => {
    callbackRef.current = callback
  }) // No dependency array means this effect runs after every render, updating the ref

  // The useMemo below is crucial. It returns a stable function instance (*the* memoized callback).
  // This stable function, when called, invokes the latest callback stored in callbackRef.current.
  return React.useMemo(
    () => ((...args: any[]) => callbackRef.current?.(...args)) as T,
    [] // Empty dependency array ensures this memoized callback instance never changes
  )
}
