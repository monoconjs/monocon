import type { Exact, MaybePromise, Merge, UnionToIntersection } from './_utils.ts'
import type { Context } from './context.ts'
import type { RouteMethod } from './http.ts'
import type { InjectContext } from './inject.ts'
import type { Meta, MetaPrefix, RouteMeta } from './meta.ts'
import type { PathParams } from './path.ts'
import type { SchemaOptionsOf } from './provide.ts'
import type {
  BodyOf,
  HeaderNamesOf,
  HeadersOf,
  ParamsOf,
  QueryOf,
  ResponseOutput,
  SchemaOptions,
} from './schema.ts'

declare global {
  interface RouteRecords {}
}

export type InjectOptions<Injects> = {
  [Key in keyof Injects]?: boolean
}

export type RouteOptions<Injects = {}> = SchemaOptions &
  InjectOptions<Injects> & {
    meta?: RouteMeta
  }

export type EnabledInjectKeys<Injects, Options> = {
  [Key in keyof Injects]: Key extends keyof Options
    ? Options[Key] extends false
      ? never
      : Key
    : Key
}[keyof Injects]

export type EnabledContext<Injects, Options> = InjectContext<
  Pick<Injects, EnabledInjectKeys<Injects, Options>>
>

type EnabledSchema<Injects, Options> = UnionToIntersection<
  {
    [Key in EnabledInjectKeys<Injects, Options>]: SchemaOptionsOf<Injects[Key]>
  }[EnabledInjectKeys<Injects, Options>]
>

export type RouteSchema<Injects, Options> = Merge<
  EnabledSchema<Injects, Options>,
  Pick<Options, Extract<keyof SchemaOptions, keyof Options>>
>

type MetaOf<Options> = Options extends { meta: infer Value extends object } ? Value : {}

export type RouteContext<Path extends string, Injects, Options> = Context<
  EnabledContext<Injects, Options>,
  ParamsOf<RouteSchema<Injects, Options>, PathParams<Path>>,
  QueryOf<RouteSchema<Injects, Options>>,
  BodyOf<RouteSchema<Injects, Options>>,
  MetaOf<Options>,
  ResponseOutput<RouteSchema<Injects, Options>>,
  HeadersOf<RouteSchema<Injects, Options>>,
  HeaderNamesOf<RouteSchema<Injects, Options>>
>

export type RouteResult<Injects, Options> =
  | Response
  | ResponseOutput<RouteSchema<Injects, Options>>
  | void

export interface RouteDefinition<Path extends string = string, Result = unknown> {
  method: RouteMethod
  path: Path
  handler: (ctx: Context) => MaybePromise<Result>
  options: Record<string, unknown>
}

export interface RouteBuilder<M extends Meta = Meta, Injects = {}> {
  <
    Path extends string,
    Options extends RouteOptions<Injects> | undefined = RouteOptions<Injects> | undefined,
    Result extends RouteResult<Injects, Options> = RouteResult<Injects, Options>,
  >(
    path: Path,
    handler: (ctx: RouteContext<Path, Injects, Options>) => MaybePromise<Result>,
    options?: Exact<RouteOptions<Injects>, Options>,
  ): RouteDefinition<`${MetaPrefix<M>}${Path}`, Result>
}
