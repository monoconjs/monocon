import type { MaybePromise, ProvidedOfHook } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { Schema } from './schema.ts'

export interface ProvideHooks<Provided extends object = {}> {
  readonly beforeHandle?: (ctx: Context<Provided>) => MaybePromise<object | Response | void>
  readonly afterHandle?: (
    ctx: Context<Provided>,
    result: JsonValue | Response,
  ) => MaybePromise<JsonValue | Response | void>
  readonly onError?: (error: unknown, ctx: Context<Provided>) => MaybePromise<Response | void>
  readonly schema?: Schema
}

export type ProvideLike = ProvideHooks | ((...args: any[]) => ProvideHooks)
export type Provides = Record<string, ProvideLike>

export type ResolveProvide<Provide> = Provide extends (...args: any[]) => infer Result
  ? Result
  : Provide

export type ProvidedBy<Provide> = Provide extends { beforeHandle?: infer Hook }
  ? Hook extends (...args: any[]) => any
    ? ProvidedOfHook<Hook>
    : {}
  : {}
