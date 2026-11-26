import type { MaybePromise, ProvidedOfHook } from './_utils.ts'
import type { ResponseOutput, SchemaContext, SchemaOptions } from './schema.ts'

export type ProvideContext<Options, Provided extends object = {}> = SchemaContext<Options, Provided>

export interface ProvideHooks<
  Options extends SchemaOptions = SchemaOptions,
  Provided extends object = {},
> {
  readonly schema?: Options
  readonly beforeHandle?: (
    ctx: ProvideContext<Options, Provided>,
  ) => MaybePromise<object | Response | void>
  readonly afterHandle?: (
    ctx: ProvideContext<Options, Provided>,
    result: ResponseOutput<Options> | Response,
  ) => MaybePromise<ResponseOutput<Options> | Response | void>
  readonly onError?: (
    error: unknown,
    ctx: ProvideContext<Options, Provided>,
  ) => MaybePromise<Response | void>
}

export type ProvideLike<Options extends SchemaOptions = SchemaOptions> =
  | ProvideHooks<Options>
  | ((...args: any[]) => ProvideHooks<Options>)

export type AnyProvideHooks = {
  readonly schema?: SchemaOptions
  readonly beforeHandle?: (...args: any[]) => any
  readonly afterHandle?: (...args: any[]) => any
  readonly onError?: (...args: any[]) => any
}

export type AnyProvideLike = AnyProvideHooks | ((...args: any[]) => AnyProvideHooks)

export type Provides = Record<string, AnyProvideLike>

export type ResolveProvide<Provide> = Provide extends (...args: any[]) => infer Result
  ? Result
  : Provide

export type SchemaOptionsOf<Provide> =
  ResolveProvide<Provide> extends {
    readonly schema?: infer Options extends SchemaOptions
  }
    ? Options
    : {}

export type ProvidedBy<Provide> = Provide extends { beforeHandle?: infer Hook }
  ? Hook extends (...args: any[]) => any
    ? ProvidedOfHook<Hook>
    : {}
  : {}
