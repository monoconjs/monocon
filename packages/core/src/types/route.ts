import type { MaybePromise, Merge } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { RouteMethod } from './http.ts'
import type { InjectContext } from './inject.ts'
import type { Meta, MetaPrefix, RouteMeta } from './meta.ts'
import type { PathParams } from './path.ts'
import type { InferOutput, Schema } from './schema.ts'

declare global {
  interface RouteRecords {}
}

export interface SchemaOptions {
  params?: Schema
  query?: Schema
  body?: Schema
  headers?: Schema
  response?: Schema
}

export type InjectOptions<Injects> = {
  [Key in keyof Injects]?: boolean
}

export type RouteOptions<Injects = {}> = SchemaOptions &
  InjectOptions<Injects> & {
    meta?: RouteMeta
  }

type AsObject<Value> = Value extends object ? Value : {}

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

type ParamsOf<Path extends string, Options> = Options extends {
  params: infer Parsed extends Schema
}
  ? Merge<PathParams<Path>, AsObject<InferOutput<Parsed>>>
  : PathParams<Path>

type QueryOf<Options> = Options extends { query: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : URLSearchParams

type BodyOf<Options> = Options extends { body: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : unknown

type MetaOf<Options> = Options extends { meta: infer Value extends object } ? Value : {}

type ResponseOutput<Options> = Options extends { response: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : JsonValue

type HeadersOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? Headers & AsObject<InferOutput<Parsed>>
  : Headers

type HeaderNamesOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? keyof AsObject<InferOutput<Parsed>> & string
  : string

export type RouteContext<Path extends string, Injects, Options> = Context<
  EnabledContext<Injects, Options>,
  ParamsOf<Path, Options>,
  QueryOf<Options>,
  BodyOf<Options>,
  MetaOf<Options>,
  ResponseOutput<Options>,
  HeadersOf<Options>,
  HeaderNamesOf<Options>
>

export type RouteResult<Options> = Options extends { response: infer Parsed extends Schema }
  ? Response | InferOutput<Parsed> | void
  : JsonValue | Response | void

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
