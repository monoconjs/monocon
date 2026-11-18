import type { ErrorMap, ErrorStatusMap } from '../global.ts'
import type { MaybePromise } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { InferOutput, Schema } from './schema.ts'

export type ErrorCode = Extract<keyof ErrorMap, string>

export interface ErrorFactory<Payload, Status extends number = number> {
  (payload: Payload): ErrorInstance<Payload, Status>
  new (payload: Payload): ErrorInstance<Payload, Status>
  readonly '~payload': Payload
  readonly '~status': Status
}

export interface ErrorInstance<Payload, Status extends number> extends Error {
  readonly name: ErrorCode
  readonly status: Status
  readonly error: Payload
}

export interface ErrorOptions<Error extends Schema, Status extends number> {
  readonly name?: string
  readonly status: Status
  readonly payload: Error
  readonly toResponse?: (payload: InferOutput<Error>) => Response
}

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
      /** The error code identifying the kind of error. */
      readonly name: Code
      /** The payload carried by the error. */
      readonly payload: PayloadOf<Code>
      /** The HTTP status code associated with the error. */
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
