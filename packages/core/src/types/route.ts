import type { MaybePromise, Merge, ProvidedOfHook, Simplify } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { ErrorCode, ErrorContextOf } from './error.ts'
import type { RouteMethod } from './http.ts'
import type { MiddlewareFor } from './middleware.ts'
import type { InferOutput, Schema } from './schema.ts'

export type RouteMeta = Record<string, unknown>

export interface SchemaOptions {
  params?: Schema
  query?: Schema
  body?: Schema
  headers?: Schema
  response?: Schema
}

export interface ResponseSchemaOptions {
  response?: Schema
}

export interface RouteOptions extends SchemaOptions {
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

type MergeStageOptions<Old extends RouteOptions, Next extends SchemaOptions> = Simplify<
  Omit<Old, keyof Next | 'response'> &
    Omit<Next, 'response'> &
    ('response' extends keyof Old
      ? Pick<Old, 'response'>
      : 'response' extends keyof Next
        ? Pick<Next, 'response'>
        : {})
>

type WithStageState<State extends RouteState, Schemas extends SchemaOptions> = RouteState<
  State['~method'],
  State['~path'],
  MergeStageOptions<OptionsOf<State>, Schemas>,
  State['~provided']
>

type WithHookSchemas<State extends RouteState, Schemas extends SchemaOptions, Fn> = RouteState<
  State['~method'],
  State['~path'],
  OptionsOf<WithStageState<State, Schemas>>,
  State['~provided'] & ProvidedOfHook<Fn>
>

type ResponseOnly<Schemas extends ResponseSchemaOptions> = Schemas &
  Record<Exclude<keyof Schemas, 'response'>, never>

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
  MiddlewareFor<State['~method'], State['~path']> & State['~provided'],
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
  MiddlewareFor<State['~method'], State['~path']> & State['~provided'],
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

interface RouteMethods<State extends RouteState> {
  onRequest: <
    Schemas extends SchemaOptions = {},
    Fn extends RouteHook<WithStageState<State, Schemas>> = RouteHook<
      WithStageState<State, Schemas>
    >,
  >(
    hook: Fn,
    schemas?: Schemas,
  ) => RouteBuilder<'onRequest', WithHookSchemas<State, Schemas, Fn>>

  beforeHandle: <
    Schemas extends SchemaOptions = {},
    Fn extends RouteHook<WithStageState<State, Schemas>> = RouteHook<
      WithStageState<State, Schemas>
    >,
  >(
    hook: Fn,
    schemas?: Schemas,
  ) => RouteBuilder<'beforeHandle', WithHookSchemas<State, Schemas, Fn>>

  handle: <Schemas extends SchemaOptions = {}>(
    handler: RouteHandler<WithStageState<State, Schemas>>,
    schemas?: Schemas,
  ) => Route<
    State['~method'],
    State['~path'],
    OptionsOf<WithStageState<State, Schemas>>,
    State['~provided']
  >

  afterHandle: <
    Schemas extends ResponseSchemaOptions = {},
    Next extends RouteState = WithStageState<State, Schemas>,
    Result extends ResponseOutput<OptionsOf<Next>> | Response =
      | ResponseOutput<OptionsOf<Next>>
      | Response,
  >(
    hook: (ctx: RouteContext<Next>, result: Result) => MaybePromise<Result | void>,
    schemas?: ResponseOnly<Schemas>,
  ) => Route<State['~method'], State['~path'], OptionsOf<Next>, State['~provided'], 'afterHandle'>

  onResponse: <
    Schemas extends ResponseSchemaOptions = {},
    Next extends RouteState = WithStageState<State, Schemas>,
  >(
    hook: (ctx: RouteContext<Next>, response: Response) => MaybePromise<Response | void>,
    schemas?: ResponseOnly<Schemas>,
  ) => Route<State['~method'], State['~path'], OptionsOf<Next>, State['~provided'], 'onResponse'>

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

export type MetaOptions<Meta extends RouteMeta> = keyof Meta extends never ? {} : { meta: Meta }

export type RouteFactory<Method extends RouteMethod> = <
  Path extends string,
  Meta extends RouteMeta = {},
>(
  path: Path,
  meta?: Meta,
) => RouteBuilder<'onRequest', RouteState<Method, Path, MetaOptions<Meta>>>
