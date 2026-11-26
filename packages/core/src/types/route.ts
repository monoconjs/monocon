import type { MaybePromise } from './_utils.ts'
import type { Context } from './context.ts'
import type { RouteMethod } from './http.ts'
import type { InjectContext } from './inject.ts'
import type { Meta, MetaPrefix, RouteMeta } from './meta.ts'
import type { PathParams } from './path.ts'
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

type MetaOf<Options> = Options extends { meta: infer Value extends object } ? Value : {}

export type RouteContext<Path extends string, Injects, Options> = Context<
  EnabledContext<Injects, Options>,
  ParamsOf<Options, PathParams<Path>>,
  QueryOf<Options>,
  BodyOf<Options>,
  MetaOf<Options>,
  ResponseOutput<Options>,
  HeadersOf<Options>,
  HeaderNamesOf<Options>
>

export type RouteResult<Options> = Response | ResponseOutput<Options> | void

export interface RouteDefinition<Path extends string = string, Result = unknown> {
  method: RouteMethod
  path: Path
  handler: (ctx: Context) => MaybePromise<Result>
  options: Record<string, unknown>
}

export interface RouteBuilder<M extends Meta = Meta, Injects = {}> {
  <
    Path extends string,
    Options extends RouteOptions<Injects>,
    Result extends RouteResult<Options> = RouteResult<Options>,
  >(
    path: Path,
    handler: (ctx: RouteContext<Path, Injects, Options>) => MaybePromise<Result>,
    options?: Options,
  ): RouteDefinition<`${MetaPrefix<M>}${Path}`, Result>
}
