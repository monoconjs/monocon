import type { Simplify, UnionToIntersection } from './_utils.ts'
import type { ProvideLike, ProvidedBy, Provides, ResolveProvide } from './provide.ts'

export type Injects = Provides

export interface InjectRegistry {
  __global?: true
  readonly [key: string]: ProvideLike | true | undefined
}

// oxlint-disable-next-line no-shadow
export type InjectContext<Injects> = Simplify<
  UnionToIntersection<
    {
      [Key in keyof Injects]: ProvidedBy<ResolveProvide<Injects[Key]>>
    }[keyof Injects]
  >
>
