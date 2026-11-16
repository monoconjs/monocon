import {
  createContext,
  extractParams,
  parseBody,
  parseQuery,
  type RuntimeContext,
} from './context.ts'
import type { EndpointLifecycle, RuntimeEndpoint } from './endpoint.ts'
import type { RuntimeMiddleware } from './middleware.ts'
import { matchMiddlewares } from './pattern.ts'
import { validate } from './validation.ts'

type Hook = (...args: any[]) => any

export interface ExecuteOptions {
  readonly middlewares?: RuntimeMiddleware[]
}

export async function execute(
  endpoint: RuntimeEndpoint,
  request: Request,
  options: ExecuteOptions = {},
): Promise<Response> {
  const url = new URL(request.url)
  const optionsOf = endpoint['~options']

  const rawParams = extractParams(endpoint['~path'], url.pathname)
  const params = await validate('params', optionsOf.params, rawParams)
  const searchParams = parseQuery(url)
  const query = await validate(
    'query',
    optionsOf.query,
    optionsOf.query ? Object.fromEntries(searchParams) : searchParams,
  )
  const body = await validate('body', optionsOf.body, await parseBody(request))
  const headers = await validate('headers', optionsOf.headers, Object.fromEntries(request.headers))

  const ctx = createContext({
    req: request,
    url,
    params: isProvided(params) ? params : rawParams,
    query,
    body,
    meta: optionsOf.meta ?? {},
  })
  if (isProvided(headers)) Object.assign(ctx.headers, headers)

  const middlewares = matchMiddlewares(options.middlewares ?? [], endpoint['~path'])
  const handler = endpoint['~handler']
  if (!handler)
    throw new Error(`Endpoint ${endpoint['~method']} ${endpoint['~path']} has no handler`)

  const shortCircuit = await runBeforeHooks(
    [...middlewareHooks(middlewares, 'onRequest'), ...endpoint['~hooks'].onRequest],
    ctx,
  )
  if (shortCircuit) return finalize(shortCircuit, ctx, endpoint, middlewares)

  const beforeResult = await runBeforeHooks(
    [...middlewareHooks(middlewares, 'beforeHandle'), ...endpoint['~hooks'].beforeHandle],
    ctx,
  )
  if (beforeResult) return finalize(beforeResult, ctx, endpoint, middlewares)

  const result = await runAfterHooks(
    [...endpoint['~hooks'].afterHandle, ...middlewareHooks(middlewares, 'afterHandle')],
    ctx,
    await handler(ctx),
  )

  return finalize(toResponse(result), ctx, endpoint, middlewares)
}

async function finalize(
  response: Response,
  ctx: RuntimeContext,
  endpoint: RuntimeEndpoint,
  middlewares: RuntimeMiddleware[],
): Promise<Response> {
  return runResponseHooks(
    [...endpoint['~hooks'].onResponse, ...middlewareHooks(middlewares, 'onResponse')],
    ctx,
    response,
  )
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

function middlewareHooks(middlewares: RuntimeMiddleware[], stage: EndpointLifecycle): Hook[] {
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
