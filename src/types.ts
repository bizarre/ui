import { Scope } from '@radix-ui/react-context'

export type ScopedProps<P> = P & { __scope?: Scope }
