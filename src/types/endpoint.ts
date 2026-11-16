import type { MaybePromise, Merge, Simplify } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { EndpointMethod } from './http.ts'
import type { MiddlewareFor } from './middleware.ts'
import type { InferOutput, Schema } from './schema.ts'

export type EndpointMeta = Record<string, unknown>

export interface EndpointOptions {
  params?: Schema
  query?: Schema
  body?: Schema
  headers?: Schema
  response?: Schema
  meta?: EndpointMeta
}

export interface EndpointState<
  Method extends EndpointMethod = EndpointMethod,
  Path extends string = string,
  Options extends EndpointOptions = EndpointOptions,
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

type OptionsOf<State extends EndpointState> = State['~options']

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

export type EndpointContext<State extends EndpointState> = Context<
  MiddlewareFor<State['~path']> & State['~provided'],
  ParamsOf<State['~path'], OptionsOf<State>>,
  QueryOf<OptionsOf<State>>,
  BodyOf<OptionsOf<State>>,
  MetaOf<OptionsOf<State>>,
  ResponseOutput<OptionsOf<State>>,
  HeadersOf<OptionsOf<State>>,
  HeaderNamesOf<OptionsOf<State>>
>

export type EndpointHook<State extends EndpointState> = (
  ctx: EndpointContext<State>,
) => MaybePromise<object | Response | void>

export type ProvidedOfHook<Fn> = Fn extends (...args: any[]) => infer Result
  ? Exclude<Awaited<Result>, Response | void | null | undefined> extends infer Provided
    ? Provided extends object
      ? [keyof Provided] extends [never]
        ? {}
        : Provided
      : {}
    : {}
  : {}

export type EndpointResult<Options extends EndpointOptions> =
  | Response
  | ResponseOutput<Options>
  | void

export type EndpointHandler<State extends EndpointState> = (
  ctx: EndpointContext<State>,
) => MaybePromise<EndpointResult<OptionsOf<State>>>

export type EndpointAfterHook<State extends EndpointState> = (
  ctx: EndpointContext<State>,
  result: ResponseOutput<OptionsOf<State>> | Response,
) => MaybePromise<ResponseOutput<OptionsOf<State>> | Response | void>

export type EndpointResponseHook<State extends EndpointState> = (
  ctx: EndpointContext<State>,
  response: Response,
) => MaybePromise<Response | void>

export type EndpointStage = 'onRequest' | 'beforeHandle' | 'handle' | 'afterHandle' | 'onResponse'

type FinalStage = 'handle' | 'afterHandle' | 'onResponse'

type WithProvided<State extends EndpointState, Fn> = EndpointState<
  State['~method'],
  State['~path'],
  OptionsOf<State>,
  State['~provided'] & ProvidedOfHook<Fn>
>

interface EndpointMethods<State extends EndpointState> {
  onRequest: <Fn extends EndpointHook<State>>(
    hook: Fn,
  ) => EndpointBuilder<'onRequest', WithProvided<State, Fn>>

  beforeHandle: <Fn extends EndpointHook<State>>(
    hook: Fn,
  ) => EndpointBuilder<'beforeHandle', WithProvided<State, Fn>>

  handle: (
    handler: EndpointHandler<State>,
  ) => Endpoint<State['~method'], State['~path'], OptionsOf<State>, State['~provided']>

  afterHandle: <Result extends ResponseOutput<OptionsOf<State>> | Response>(
    hook: (ctx: EndpointContext<State>, result: Result) => MaybePromise<Result | void>,
  ) => Endpoint<
    State['~method'],
    State['~path'],
    OptionsOf<State>,
    State['~provided'],
    'afterHandle'
  >

  onResponse: (
    hook: EndpointResponseHook<State>,
  ) => Endpoint<
    State['~method'],
    State['~path'],
    OptionsOf<State>,
    State['~provided'],
    'onResponse'
  >
}

type AvailableMethods<Stage extends EndpointStage> =
  | (Stage extends 'onRequest' ? 'onRequest' : never)
  | (Stage extends 'onRequest' | 'beforeHandle' ? 'beforeHandle' : never)
  | (Stage extends 'onRequest' | 'beforeHandle' ? 'handle' : never)
  | (Stage extends 'handle' | 'afterHandle' ? 'afterHandle' : never)
  | (Stage extends 'handle' | 'afterHandle' | 'onResponse' ? 'onResponse' : never)

export type EndpointBuilder<Stage extends EndpointStage, State extends EndpointState> = Pick<
  EndpointMethods<State>,
  AvailableMethods<Stage>
>

export type Endpoint<
  Method extends EndpointMethod = EndpointMethod,
  Path extends string = string,
  Options extends EndpointOptions = {},
  Provided extends object = {},
  Stage extends FinalStage = 'handle',
> = EndpointState<Method, Path, Options, Provided> & {
  '~handler': EndpointHandler<EndpointState<Method, Path, Options, Provided>>
} & Pick<EndpointMethods<EndpointState<Method, Path, Options, Provided>>, AvailableMethods<Stage>>

export type EndpointFactory<Method extends EndpointMethod> = <
  Path extends string,
  Options extends EndpointOptions = {},
>(
  path: Path,
  options?: Options,
) => EndpointBuilder<'onRequest', EndpointState<Method, Path, Options>>
