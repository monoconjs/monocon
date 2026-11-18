import type { MaybePromise, Merge, ProvidedOfHook, Simplify } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { ErrorCode, ErrorContextOf } from './error.ts'
import type { RouteMethod } from './http.ts'
import type { MiddlewareFor } from './middleware.ts'
import type { InferOutput, Schema } from './schema.ts'

export type RouteMeta = Record<string, unknown>

export interface RouteOptions {
  params?: Schema
  query?: Schema
  body?: Schema
  headers?: Schema
  response?: Schema
  meta?: RouteMeta
}

export interface RouteState<
  Method extends RouteMethod = RouteMethod,
  Path extends string = string,
  Options extends RouteOptions = RouteOptions,
  Provided extends object = {},
> {
  '~method': Method
  '~path': Path
  '~options': Options
  '~provided': Provided
}

type SplitPath<Path extends string> = Path extends `${infer Head}/${infer Rest}`
  ? [Head, ...SplitPath<Rest>]
  : [Path]

type SegmentsToParams<Segments extends readonly string[]> = Segments extends readonly [
  infer Head extends string,
  ...infer Rest extends readonly string[],
]
  ? Head extends `:${infer Name}`
    ? { [Key in Name]: string } & SegmentsToParams<Rest>
    : Head extends '*'
      ? { wildcard: string } & SegmentsToParams<Rest>
      : SegmentsToParams<Rest>
  : {}

export type PathParams<Path extends string> = Simplify<SegmentsToParams<SplitPath<Path>>>

type AsObject<Value> = Value extends object ? Value : {}

type OptionsOf<State extends RouteState> = State['~options']

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

type MetaOf<Options> = Options extends { meta: infer Meta extends object } ? Meta : {}

type ResponseOutput<Options> = Options extends { response: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : JsonValue

type HeadersOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? Headers & AsObject<InferOutput<Parsed>>
  : Headers

type HeaderNamesOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? keyof AsObject<InferOutput<Parsed>> & string
  : string

export type RouteContext<State extends RouteState> = Context<
  MiddlewareFor<State['~path']> & State['~provided'],
  ParamsOf<State['~path'], OptionsOf<State>>,
  QueryOf<OptionsOf<State>>,
  BodyOf<OptionsOf<State>>,
  MetaOf<OptionsOf<State>>,
  ResponseOutput<OptionsOf<State>>,
  HeadersOf<OptionsOf<State>>,
  HeaderNamesOf<OptionsOf<State>>
>

export type RouteHook<State extends RouteState> = (
  ctx: RouteContext<State>,
) => MaybePromise<object | Response | void>

export type { ProvidedOfHook } from './_utils.ts'

export type RouteResult<Options extends RouteOptions> = Response | ResponseOutput<Options> | void

export type RouteHandler<State extends RouteState> = (
  ctx: RouteContext<State>,
) => MaybePromise<RouteResult<OptionsOf<State>>>

export type RouteAfterHook<State extends RouteState> = (
  ctx: RouteContext<State>,
  result: ResponseOutput<OptionsOf<State>> | Response,
) => MaybePromise<ResponseOutput<OptionsOf<State>> | Response | void>

export type RouteResponseHook<State extends RouteState> = (
  ctx: RouteContext<State>,
  response: Response,
) => MaybePromise<Response | void>

export type RouteErrorContext<State extends RouteState> = ErrorContextOf<
  ErrorCode,
  MiddlewareFor<State['~path']> & State['~provided'],
  ParamsOf<State['~path'], OptionsOf<State>>,
  QueryOf<OptionsOf<State>>,
  BodyOf<OptionsOf<State>>,
  MetaOf<OptionsOf<State>>,
  ResponseOutput<OptionsOf<State>>,
  HeadersOf<OptionsOf<State>>,
  HeaderNamesOf<OptionsOf<State>>
>

export type RouteErrorHook<State extends RouteState> = (
  ctx: RouteErrorContext<State>,
) => MaybePromise<Response | void>

export type RouteStage = 'onRequest' | 'beforeHandle' | 'handle' | 'afterHandle' | 'onResponse'

type FinalStage = 'handle' | 'afterHandle' | 'onResponse'

type WithProvided<State extends RouteState, Fn> = RouteState<
  State['~method'],
  State['~path'],
  OptionsOf<State>,
  State['~provided'] & ProvidedOfHook<Fn>
>

interface RouteMethods<State extends RouteState> {
  onRequest: <Fn extends RouteHook<State>>(
    hook: Fn,
  ) => RouteBuilder<'onRequest', WithProvided<State, Fn>>

  beforeHandle: <Fn extends RouteHook<State>>(
    hook: Fn,
  ) => RouteBuilder<'beforeHandle', WithProvided<State, Fn>>

  handle: (
    handler: RouteHandler<State>,
  ) => Route<State['~method'], State['~path'], OptionsOf<State>, State['~provided']>

  afterHandle: <Result extends ResponseOutput<OptionsOf<State>> | Response>(
    hook: (ctx: RouteContext<State>, result: Result) => MaybePromise<Result | void>,
  ) => Route<State['~method'], State['~path'], OptionsOf<State>, State['~provided'], 'afterHandle'>

  onResponse: (
    hook: RouteResponseHook<State>,
  ) => Route<State['~method'], State['~path'], OptionsOf<State>, State['~provided'], 'onResponse'>

  onError: (
    hook: RouteErrorHook<State>,
  ) => Route<State['~method'], State['~path'], OptionsOf<State>, State['~provided'], 'onResponse'>
}

type AvailableMethods<Stage extends RouteStage> =
  | (Stage extends 'onRequest' ? 'onRequest' : never)
  | (Stage extends 'onRequest' | 'beforeHandle' ? 'beforeHandle' : never)
  | (Stage extends 'onRequest' | 'beforeHandle' ? 'handle' : never)
  | (Stage extends 'handle' | 'afterHandle' ? 'afterHandle' : never)
  | (Stage extends 'handle' | 'afterHandle' | 'onResponse' ? 'onResponse' : never)
  | 'onError'

export type RouteBuilder<Stage extends RouteStage, State extends RouteState> = Pick<
  RouteMethods<State>,
  AvailableMethods<Stage>
>

export type Route<
  Method extends RouteMethod = RouteMethod,
  Path extends string = string,
  Options extends RouteOptions = {},
  Provided extends object = {},
  Stage extends FinalStage = 'handle',
> = RouteState<Method, Path, Options, Provided> & {
  '~handler': RouteHandler<RouteState<Method, Path, Options, Provided>>
} & Pick<RouteMethods<RouteState<Method, Path, Options, Provided>>, AvailableMethods<Stage>>

export type RouteFactory<Method extends RouteMethod> = <
  Path extends string,
  Options extends RouteOptions = {},
>(
  path: Path,
  options?: Options,
) => RouteBuilder<'onRequest', RouteState<Method, Path, Options>>
