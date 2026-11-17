import type { ErrorMap, ErrorStatusMap } from '../global.ts'
import type { MaybePromise } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { InferOutput, Schema } from './schema.ts'

export type ErrorCode = Extract<keyof ErrorMap, string>

export interface ErrorFactory<Payload, Status extends number = number> {
  (payload: Payload): ErrorInstance<Payload, Status>
  readonly '~body': Payload
  readonly '~status': Status
}

export interface ErrorInstance<Payload, Status extends number> extends Error {
  readonly code: ErrorCode
  readonly status: Status
  readonly body: Payload
}

export interface ErrorOptions<Body extends Schema, Status extends number> {
  readonly status: Status
  readonly body: Body
  readonly toResponse?: (body: InferOutput<Body>) => Response
}

export declare function error<Body extends Schema, Status extends number>(
  options: ErrorOptions<Body, Status>,
): ErrorFactory<InferOutput<Body>, Status>

export type PayloadOf<Code extends ErrorCode> = ErrorMap[Code]

export type StatusOf<Code extends ErrorCode> = Code extends keyof ErrorStatusMap
  ? ErrorStatusMap[Code]
  : never

export type ErrorStage =
  | 'validation'
  | 'onRequest'
  | 'beforeHandle'
  | 'handle'
  | 'afterHandle'
  | 'onResponse'

type ErrorDetail<Code extends ErrorCode> = Code extends ErrorCode
  ? {
      readonly code: Code
      readonly error: PayloadOf<Code>
      readonly status: StatusOf<Code>
    }
  : never

export type ErrorContextOf<
  Codes extends ErrorCode,
  Extras extends object = {},
  Params extends object = Record<string, string>,
  Query = URLSearchParams,
  Body = unknown,
  Meta extends object = Record<string, never>,
  Output = JsonValue,
  HeadersType = Headers,
  HeaderName extends string = string,
> = Context<Extras, Params, Query, Body, Meta, Output, HeadersType, HeaderName> &
  ErrorDetail<Codes> & {
    readonly stage: ErrorStage
  }

export type ErrorContext = ErrorContextOf<ErrorCode>

export type ErrorHandlerOf<Codes extends ErrorCode> = (
  ctx: ErrorContextOf<Codes>,
) => MaybePromise<Response | void>

export declare function onError<const Codes extends readonly ErrorCode[]>(
  handler: ErrorHandlerOf<Codes[number]>,
  deps: Codes,
): void

export declare function onError(handler: ErrorHandlerOf<ErrorCode>): void
