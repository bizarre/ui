/**
 * Represents a single matched token within a larger string.
 * @template T The type of the structured data associated with the match.
 * @template N The literal string type of the matcher's name.
 */
export type Match<T = unknown, N extends string = string> = {
  /** The raw matched text span from the original string. */
  raw: string
  /** The start index of the match in the full string. */
  start: number
  /** The end index of the match in the full string. */
  end: number
  /** A structured object with parsed values defined by the matcher. */
  data: T
  /** The unique `name` of the matcher that produced this match. */
  matcher: N
}

/**
 * A utility type that constructs a `Match` type from a `Matcher` type.
 * It infers the data type `T` and the literal name `N` from the matcher.
 * This is key to creating a discriminated union for the `scan` function's return type.
 */
export type MatchFromMatcher<M> =
  M extends Matcher<infer T, infer N> ? Match<T, N> : never

type MatchData<T> = Omit<Match<T>, 'matcher'>

/**
 * Defines a configuration for finding a specific kind of token.
 * It's a generic interface that can be implemented using various strategies (e.g., regex, prefix, custom logic).
 * @template T The type of the structured data this matcher will produce.
 * @template N The literal string type of the matcher's name.
 */
export type Matcher<T = unknown, N extends string = string> = {
  /** A unique name for the matcher, used to identify which matcher found a token. */
  name: N
  /**
   * The core matching logic. It scans the input text and returns all found tokens.
   * @param text The full string to scan.
   * @returns An array of match data, without the `matcher` property.
   */
  match: (text: string) => MatchData<T>[]
}

/**
 * Scans a string for tokens using a set of configured matchers.
 *
 * This function is the core of the token matching utility. It orchestrates the matching process
 * by running all provided matchers over the input text and consolidating the results.
 * Each matcher can produce a different type of structured data, and the return type will
 * be a discriminated union of all possible `Match` types, inferred from the provided matchers.
 *
 * @param text The full string to scan.
 * @param matchers An array of `Matcher` objects to run on the string. The use of `<const M>` ensures
 *                 that the literal types of matcher names are preserved for type inference.
 * @returns An array of all `Match` objects found, sorted by their start index.
 *          The type of each element is a discriminated union of all possible `Match` types.
 *          Consumers can switch on `match.matcher` to safely access `match.data`.
 */
export function scan<const M extends readonly Matcher<unknown>[]>(
  text: string,
  matchers: M
): MatchFromMatcher<M[number]>[] {
  const allMatches = matchers.flatMap((matcher) =>
    matcher.match(text).map((m) => ({ ...m, matcher: matcher.name }))
  ) as MatchFromMatcher<M[number]>[]

  // Sort by start position ascending, then by length descending (longest first at same position)
  // This ensures the longest match at each position is considered first
  allMatches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.end - b.start - (a.end - a.start)
  })

  // Greedy algorithm: accept non-overlapping matches, preferring longer ones
  // When two matches overlap, the one starting earlier (or longer at same position) wins
  const accepted: typeof allMatches = []
  let lastEnd = -1
  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      accepted.push(match)
      lastEnd = match.end
    }
  }

  return accepted
}

/**
 * Options for creating a regex-based matcher.
 * @template T The type of the structured data the matcher will produce.
 */
type RegexMatcherOptions<T> = {
  /** The regular expression to match against. Must include the 'g' flag for global matching. */
  regex: RegExp
  /** A function to transform the raw regex match array into the desired structured data. */
  transform: (match: RegExpExecArray) => T
}

/**
 * A factory function to create a `Matcher` that uses a regular expression.
 * This simplifies the creation of matchers for patterns that can be described with regex.
 *
 * @template T The type of the structured data the created matcher will produce.
 * @param name The unique name for this matcher.
 * @param options The configuration for the regex matcher.
 * @returns A new `Matcher` object.
 */
export function createRegexMatcher<T, const N extends string>(
  name: N,
  options: RegexMatcherOptions<T>
): Matcher<T, N> {
  if (!options.regex.global) {
    throw new Error('createRegexMatcher requires a global regex (e.g. /.../g)')
  }
  if (options.regex.sticky) {
    throw new Error(
      `createRegexMatcher does not support the sticky 'y' flag, as it interferes with scanning.`
    )
  }

  return {
    name,
    match: (text: string): MatchData<T>[] => {
      const matches: MatchData<T>[] = []
      let regexMatch: RegExpExecArray | null

      // Important: Reset lastIndex on the regex before each new scan.
      options.regex.lastIndex = 0

      while ((regexMatch = options.regex.exec(text)) !== null) {
        // This check is necessary to avoid infinite loops with zero-width matches.
        if (regexMatch.index === options.regex.lastIndex) {
          options.regex.lastIndex++
        }

        matches.push({
          raw: regexMatch[0],
          start: regexMatch.index,
          end: regexMatch.index + regexMatch[0].length,
          data: options.transform(regexMatch)
        })
      }
      return matches
    }
  }
}

/**
 * Filters an array of matches to only include those from a specific matcher.
 * This is a type-safe alternative to `matches.filter(m => m.matcher === '...')`.
 *
 * @param matches The array of `Match` objects to filter.
 * @param matcherName The name of the matcher to filter by.
 * @returns A new array containing only the matches from the specified matcher,
 *          with the `data` property correctly typed.
 */
export function filterMatchesByMatcher<
  M extends Match<unknown, string>,
  N extends M['matcher']
>(matches: readonly M[], matcherName: N): Extract<M, { matcher: N }>[] {
  return matches.filter(
    (match): match is Extract<M, { matcher: N }> =>
      match.matcher === matcherName
  )
}

/**
 * Groups an array of matches by their matcher name.
 *
 * @param matches An array of `Match` objects, typically from `scan`.
 * @returns A record where keys are matcher names and values are arrays of matches
 *          from that matcher, with each array correctly typed.
 */
export function groupMatchesByMatcher<M extends Match<unknown, string>>(
  matches: readonly M[]
): Partial<{ [N in M['matcher']]: Extract<M, { matcher: N }>[] }> {
  // We use a less specific type for `grouped` internally to work around a TypeScript
  // limitation where it cannot correlate the matcher name (key) with the match
  // object's type (value) within the loop. The final cast is safe because the
  // logic guarantees the structure of the returned object.
  const grouped: Record<string, M[]> = {}

  for (const match of matches) {
    const key = match.matcher
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(match)
  }

  return grouped as unknown as Partial<{
    [N in M['matcher']]: Extract<M, { matcher: N }>[]
  }>
}

// --- Grapheme segmentation helpers ---
// These utilities provide consistent grapheme cluster boundaries across engines.
// They are intentionally here since they operate purely on strings.
import Graphemer from 'graphemer'

const graphemeSplitter = new Graphemer()

export function prevGraphemeStart(text: string, index: number): number {
  if (index <= 0) return 0
  let pos = 0
  for (const cluster of graphemeSplitter.iterateGraphemes(text)) {
    const next = pos + cluster.length
    if (next >= index) return pos
    pos = next
  }
  return pos
}

export function nextGraphemeEnd(text: string, index: number): number {
  if (index >= text.length) return text.length
  let pos = 0
  for (const cluster of graphemeSplitter.iterateGraphemes(text)) {
    const next = pos + cluster.length
    if (index < next) return next
    pos = next
  }
  return text.length
}

export function snapGraphemeStart(text: string, index: number): number {
  if (index <= 0) return 0
  let pos = 0
  for (const cluster of graphemeSplitter.iterateGraphemes(text)) {
    const next = pos + cluster.length
    if (index < next) return pos
    pos = next
  }
  return pos
}

export function snapGraphemeEnd(text: string, index: number): number {
  if (index >= text.length) return text.length
  let pos = 0
  for (const cluster of graphemeSplitter.iterateGraphemes(text)) {
    const next = pos + cluster.length
    if (index <= pos) return pos
    if (index <= next) return next
    pos = next
  }
  return pos
}
