import type { RouteMiddlewareContext } from '../global.ts'
import type { MaybePromise, ProvidedOfHook, Simplify } from './_utils.ts'
import type { Context, JsonValue } from './context.ts'
import type { ErrorCode, ErrorContextOf } from './error.ts'
import type { RouteMethod } from './http.ts'

type MethodPath<Method extends RouteMethod, Path extends string> = `${Method} ${Path}`

export type MiddlewareFor<Method extends RouteMethod, Path extends string> =
  MethodPath<Method, Path> extends keyof RouteMiddlewareContext
    ? RouteMiddlewareContext[MethodPath<Method, Path>] extends object
      ? RouteMiddlewareContext[MethodPath<Method, Path>]
      : {}
    : {}

export interface MiddlewarePatternObject {
  readonly include: readonly string[]
  readonly exclude?: readonly string[]
}

export type MiddlewarePattern = string | MiddlewarePatternObject

export type MiddlewareContext<Provided extends object = {}> = Context<Provided>

export type MiddlewareHook<Provided extends object = {}> = (
  ctx: MiddlewareContext<Provided>,
) => MaybePromise<object | Response | void>

export type MiddlewareAfterHook<Provided extends object = {}> = (
  ctx: MiddlewareContext<Provided>,
  result: JsonValue | Response,
) => MaybePromise<JsonValue | Response | void>

export type MiddlewareResponseHook<Provided extends object = {}> = (
  ctx: MiddlewareContext<Provided>,
  response: Response,
) => MaybePromise<Response | void>

export type MiddlewareErrorHook<Provided extends object = {}> = (
  ctx: ErrorContextOf<ErrorCode, Provided>,
) => MaybePromise<Response | void>

export interface MiddlewareHooks {
  readonly onRequest?: MiddlewareHook
  readonly beforeHandle?: MiddlewareHook
  readonly afterHandle?: MiddlewareAfterHook
  readonly onResponse?: MiddlewareResponseHook
  readonly onError?: MiddlewareErrorHook
}

type HookProvided<Hooks extends MiddlewareHooks, Key extends keyof Hooks> = Hooks[Key] extends (
  ...args: any[]
) => any
  ? ProvidedOfHook<Hooks[Key]>
  : {}

export type MiddlewareProvided<Hooks extends MiddlewareHooks> = Simplify<
  HookProvided<Hooks, 'onRequest'> &
    HookProvided<Hooks, 'beforeHandle'> &
    HookProvided<Hooks, 'afterHandle'> &
    HookProvided<Hooks, 'onResponse'>
>

export interface Middleware<
  Pattern extends MiddlewarePattern = MiddlewarePattern,
  Hooks extends MiddlewareHooks = MiddlewareHooks,
> {
  readonly '~pattern': Pattern
  readonly '~hooks': Hooks
  readonly '~provided': MiddlewareProvided<Hooks>
}
