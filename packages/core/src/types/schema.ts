import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { Merge } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'

export type StandardSchema<Output = unknown> = StandardSchemaV1<unknown, Output>
export type StandardSchemaIssue = StandardSchemaV1.Issue
export type StandardSchemaResult<Output> = StandardSchemaV1.Result<Output>

export type Schema = StandardSchemaV1

export type InferOutput<S> = S extends Schema
  ? NonNullable<S['~standard']['types']>['output']
  : unknown

export interface SchemaOptions {
  params?: Schema
  query?: Schema
  body?: Schema
  headers?: Schema
  response?: Schema
}

type AsObject<Value> = Value extends object ? Value : {}

export type ParamsOf<Options, Base extends object = Record<string, string>> = Options extends {
  params: infer Parsed extends Schema
}
  ? Merge<Base, AsObject<InferOutput<Parsed>>>
  : Base

export type QueryOf<Options> = Options extends { query: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : URLSearchParams

export type BodyOf<Options> = Options extends { body: infer Parsed extends Schema }
  ? InferOutput<Parsed>
  : unknown

export type ResponseOutput<Options> = Options extends {
  response: infer Parsed extends Schema
}
  ? InferOutput<Parsed>
  : JsonValue

export type HeadersOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? Headers & AsObject<InferOutput<Parsed>>
  : Headers

export type HeaderNamesOf<Options> = Options extends { headers: infer Parsed extends Schema }
  ? keyof AsObject<InferOutput<Parsed>> & string
  : string

export type SchemaContext<
  Options,
  Extras extends object = {},
  Params extends object = Record<string, string>,
> = Context<
  Extras,
  ParamsOf<Options, Params>,
  QueryOf<Options>,
  BodyOf<Options>,
  Record<string, never>,
  ResponseOutput<Options>,
  HeadersOf<Options>,
  HeaderNamesOf<Options>
>
