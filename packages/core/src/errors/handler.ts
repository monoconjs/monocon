import { createContext, type RuntimeContext } from '../context.ts'
import type { RuntimeMiddleware } from '../middleware.ts'
import type { RuntimeRoute } from '../route.ts'
import type { ErrorCode, ErrorHandlerOf, ErrorStage } from '../types/error.ts'
import type { ErrorHook } from './factory.ts'

interface RegisteredHandler {
  readonly handler: ErrorHook
  readonly names: readonly string[] | undefined
}

const globalHandlers: RegisteredHandler[] = []

export function onError(handler: ErrorHandlerOf<ErrorCode>, deps: readonly []): void
export function onError<const Names extends readonly ErrorCode[]>(
  handler: ErrorHandlerOf<Names[number]>,
  deps: Names,
): void
export function onError(handler: ErrorHandlerOf<ErrorCode>): void
export function onError(handler: ErrorHandlerOf<ErrorCode>, deps?: readonly ErrorCode[]): void {
  globalHandlers.push({ handler, names: deps?.length ? deps : undefined })
}

export function clearErrorHandlers(): void {
  globalHandlers.length = 0
}

export interface ErrorDispatch {
  readonly error: unknown
  readonly request: Request
  readonly url: URL
  readonly context?: RuntimeContext
  readonly route?: RuntimeRoute
  readonly middlewares?: readonly RuntimeMiddleware[]
  readonly stage: ErrorStage
}

export async function handleError(dispatch: ErrorDispatch): Promise<Response> {
  const { error: thrown, request, url, context, route, middlewares, stage } = dispatch

  const name = resolveName(thrown)
  const status = resolveStatus(thrown)
  const payload = resolveError(thrown)
  const base =
    context ??
    createContext({
      req: request,
      url,
      params: {},
      query: url.searchParams,
      body: undefined,
      meta: {},
    })
  const errorContext = { ...base, name, payload, status, stage }

  const handlers: ErrorHook[] = []
  if (route) handlers.push(...route['~hooks'].onError)
  if (middlewares) handlers.push(...middlewareErrorHooks(middlewares))
  for (const entry of globalHandlers) {
    if (entry.names === undefined || entry.names.includes(name)) handlers.push(entry.handler)
  }

  for (const handler of handlers) {
    // oxlint-disable-next-line no-await-in-loop
    const output = await handler(errorContext)
    if (output instanceof Response) return output
  }

  const toResponse = findToResponse(thrown)
  if (toResponse) return toResponse(payload)

  throw thrown
}

function findToResponse(thrown: unknown): ((payload: any) => Response) | undefined {
  if (typeof thrown !== 'object' || thrown === null || !('~toResponse' in thrown)) return undefined
  const toResponse = thrown['~toResponse']
  return isToResponse(toResponse) ? toResponse : undefined
}

function isToResponse(value: unknown): value is (payload: any) => Response {
  return typeof value === 'function'
}

function resolveName(thrown: unknown): string {
  if (typeof thrown === 'object' && thrown !== null && 'name' in thrown) {
    const name = thrown.name
    if (typeof name === 'string') return name
  }
  return 'INTERNAL_ERROR'
}

function resolveStatus(thrown: unknown): number {
  if (typeof thrown === 'object' && thrown !== null && 'status' in thrown) {
    const status = thrown.status
    if (typeof status === 'number') return status
  }
  return 500
}

function resolveError(thrown: unknown): unknown {
  if (typeof thrown === 'object' && thrown !== null && 'error' in thrown) return thrown.error
  return thrown instanceof Error ? thrown.message : thrown
}

function middlewareErrorHooks(middlewares: readonly RuntimeMiddleware[]): ErrorHook[] {
  const hooks: ErrorHook[] = []
  for (const middleware of middlewares) {
    const hook = middleware['~hooks'].onError
    if (hook) hooks.push(hook)
  }
  return hooks
}
