import {
  createContext,
  extractParams,
  parseBody,
  parseQuery,
  type RuntimeContext,
} from './context.ts'
import { NoHandlerError, ParseError, handleError } from './errors/index.ts'
import type { RuntimeMiddleware } from './middleware.ts'
import { matchMiddlewares } from './pattern.ts'
import type { RouteLifecycle, RouteValidationStage, RuntimeRoute } from './route.ts'
import type { ErrorStage } from './types/error.ts'
import { validate } from './validation.ts'

type Hook = (...args: any[]) => any

export interface ExecuteOptions {
  readonly middlewares?: RuntimeMiddleware[]
  readonly skipBody?: boolean
}

export async function execute(
  route: RuntimeRoute,
  request: Request,
  options: ExecuteOptions = {},
): Promise<Response> {
  const url = new URL(request.url)
  const optionsOf = route['~options']
  const middlewares = matchMiddlewares(options.middlewares ?? [], route['~path'], route['~method'])

  let stage: ErrorStage = 'validation'
  let ctx: RuntimeContext | undefined

  try {
    const raw: RawValues = {
      params: extractParams(route['~path'], url.pathname),
      query: parseQuery(url),
      body: options.skipBody
        ? undefined
        : await parseBody(request).catch((cause: unknown) => {
            throw ParseError({ message: cause instanceof Error ? cause.message : String(cause) })
          }),
      headers: Object.fromEntries(request.headers),
    }

    ctx = createContext({
      req: request,
      url,
      params: raw.params,
      query: raw.query,
      body: raw.body,
      meta: optionsOf.meta ?? {},
    })

    stage = 'validation'
    await applyValidation(route, 'onRequest', ctx, raw)

    const handler = route['~handler']
    if (!handler) {
      throw NoHandlerError({ method: route['~method'], path: route['~path'] })
    }

    stage = 'onRequest'
    const shortCircuit = await runBeforeHooks(
      [...middlewareHooks(middlewares, 'onRequest'), ...route['~hooks'].onRequest],
      ctx,
    )
    if (shortCircuit) {
      stage = 'onResponse'
      return finalize(shortCircuit, ctx, route, middlewares)
    }

    stage = 'validation'
    await applyValidation(route, 'beforeHandle', ctx, raw)

    stage = 'beforeHandle'
    const beforeResult = await runBeforeHooks(
      [...middlewareHooks(middlewares, 'beforeHandle'), ...route['~hooks'].beforeHandle],
      ctx,
    )
    if (beforeResult) {
      stage = 'onResponse'
      return finalize(beforeResult, ctx, route, middlewares)
    }

    stage = 'validation'
    await applyValidation(route, 'handle', ctx, raw)

    stage = 'handle'
    const handled = await handler(ctx)

    stage = 'afterHandle'
    const result = await runAfterHooks(
      [...route['~hooks'].afterHandle, ...middlewareHooks(middlewares, 'afterHandle')],
      ctx,
      handled,
    )

    stage = 'onResponse'
    return finalize(toResponse(result), ctx, route, middlewares)
  } catch (error) {
    return handleError({
      error,
      request,
      url,
      context: ctx,
      route,
      middlewares,
      stage,
    })
  }
}

async function finalize(
  response: Response,
  ctx: RuntimeContext,
  route: RuntimeRoute,
  middlewares: RuntimeMiddleware[],
): Promise<Response> {
  return runResponseHooks(
    [...route['~hooks'].onResponse, ...middlewareHooks(middlewares, 'onResponse')],
    ctx,
    response,
  )
}

interface RawValues {
  readonly params: Record<string, unknown>
  readonly query: URLSearchParams
  readonly body: unknown
  readonly headers: Record<string, string>
}

async function applyValidation(
  route: RuntimeRoute,
  stage: RouteValidationStage,
  ctx: RuntimeContext,
  raw: RawValues,
): Promise<void> {
  const schemas = route['~validations'][stage]

  const params = await validate('params', schemas.params, raw.params)
  const query = await validate(
    'query',
    schemas.query,
    schemas.query ? Object.fromEntries(raw.query) : raw.query,
  )
  const body = await validate('body', schemas.body, raw.body)
  const headers = await validate('headers', schemas.headers, raw.headers)

  const values: Record<string, unknown> = {}
  if (schemas.params) values.params = isProvided(params) ? params : raw.params
  if (schemas.query) values.query = query
  if (schemas.body) values.body = body
  if (Object.keys(values).length > 0) Object.assign(ctx, values)
  if (isProvided(headers)) Object.assign(ctx.headers, headers)
}

async function runBeforeHooks(hooks: Hook[], ctx: RuntimeContext): Promise<Response | undefined> {
  for (const hook of hooks) {
    // Hooks run in order: each sees prior context changes and may short-circuit.
    // oxlint-disable-next-line no-await-in-loop
    const output = await hook(ctx)
    if (output instanceof Response) return output
    if (isProvided(output)) Object.assign(ctx, output)
  }
  return undefined
}

async function runAfterHooks(
  hooks: Hook[],
  ctx: RuntimeContext,
  initial: unknown,
): Promise<unknown> {
  let result = initial
  for (const hook of hooks) {
    // Each hook receives the previous hook's result, so order is significant.
    // oxlint-disable-next-line no-await-in-loop
    const output = await hook(ctx, result)
    if (output !== undefined) result = output
  }
  return result
}

async function runResponseHooks(
  hooks: Hook[],
  ctx: RuntimeContext,
  initial: Response,
): Promise<Response> {
  let response = initial
  for (const hook of hooks) {
    // Response hooks chain sequentially, each receiving the prior response.
    // oxlint-disable-next-line no-await-in-loop
    const output = await hook(ctx, response)
    if (output instanceof Response) response = output
  }
  return response
}

function middlewareHooks(middlewares: RuntimeMiddleware[], stage: RouteLifecycle): Hook[] {
  const hooks: Hook[] = []
  for (const middleware of middlewares) {
    const hook = middleware['~hooks'][stage]
    if (hook) hooks.push(hook)
  }
  return hooks
}

function isProvided(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !(value instanceof Response)
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result
  if (result === undefined || result === null) return new Response(null, { status: 204 })
  if (typeof result === 'string') return new Response(result)
  return Response.json(result)
}
