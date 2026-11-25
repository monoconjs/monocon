import type { MaybePromise, ProvidedOfHook, Simplify, UnionToIntersection } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { Schema } from './schema.ts'

export interface InjectHooks<Provided extends object = {}> {
  readonly beforeHandle?: (ctx: Context<Provided>) => MaybePromise<object | Response | void>
  readonly afterHandle?: (
    ctx: Context<Provided>,
    result: JsonValue | Response,
  ) => MaybePromise<JsonValue | Response | void>
  readonly onError?: (error: unknown, ctx: Context<Provided>) => MaybePromise<Response | void>
  readonly schema?: Schema
}

export type InjectLike = InjectHooks | ((...args: any[]) => InjectHooks)
export type Injects = Record<string, InjectLike>

export type ResolveInject<Inject> = Inject extends (...args: any[]) => infer Result
  ? Result
  : Inject

export type InjectProvided<Inject> = Inject extends { beforeHandle?: infer Hook }
  ? Hook extends (...args: any[]) => any
    ? ProvidedOfHook<Hook>
    : {}
  : {}

// oxlint-disable-next-line no-shadow
export type InjectContext<Injects> = Simplify<
  UnionToIntersection<
    {
      [Key in keyof Injects]: InjectProvided<ResolveInject<Injects[Key]>>
    }[keyof Injects]
  >
>
