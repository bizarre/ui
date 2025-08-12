import { Matcher } from '../../internal/string-utils'
import { TokenState } from '../../inlay'

export type Plugin<P, T, N extends string = string> = {
  props: P
  matcher: Matcher<T, N>
  render: (context: {
    token: T
    update: (newData: Partial<T>) => void
  }) => React.ReactNode
  portal: (context: {
    token: T
    state: TokenState
    replace: (newText: string) => void
    update: (newData: Partial<T>) => void
  }) => React.ReactNode | null
  onInsert: (value: T) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => boolean
}
