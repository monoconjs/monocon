import type { ErrorMap, ErrorStatusMap } from '../global.ts'
import type { HasRequiredKey, MaybePromise } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { InferOutput, Schema } from './schema.ts'

export type ErrorCode = Extract<keyof ErrorMap, string>

export type ErrorFactory<Payload, Status extends number = number> = {
  readonly '~payload': Payload
  readonly '~status': Status
} & ([Payload] extends [never]
  ? {
      (): ErrorInstance<Payload, Status>
      new (): ErrorInstance<Payload, Status>
    }
  : HasRequiredKey<Payload> extends true
    ? {
        (payload: Payload): ErrorInstance<Payload, Status>
        new (payload: Payload): ErrorInstance<Payload, Status>
      }
    : {
        (payload?: Payload): ErrorInstance<Payload, Status>
        new (payload?: Payload): ErrorInstance<Payload, Status>
      })

export interface ErrorInstance<Payload, Status extends number> extends Error {
  readonly name: ErrorCode
  readonly status: Status
  readonly error: Payload
}

export type ErrorPayload<T> = T extends Schema ? InferOutput<T> : T

export interface ErrorOptions<T = unknown, Status extends number = number> {
  readonly name?: string
  readonly status?: Status
  readonly payload?: T
  readonly toResponse?: (payload: ErrorPayload<T>) => Response
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
