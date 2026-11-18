import { z } from 'zod'

import {
  assignErrorName,
  clearErrorHandlers,
  createError,
  isErrorFactory,
} from '../packages/core/src/errors/index.ts'
import { execute } from '../packages/core/src/execute.ts'
import { collectDeclarations } from '../packages/core/src/fetch-handler.ts'
import type { RuntimeRoute } from '../packages/core/src/route.ts'
import {
  NoHandlerError,
  ParseError,
  ValidationError,
  defineError,
  defineMiddleware,
  get,
  onError,
} from '../src/index.ts'

function asRoute(value: unknown): RuntimeRoute {
  return value as RuntimeRoute
}

function request(path: string): Request {
  return new Request(`http://localhost${path}`)
}

function conflictFactory() {
  const factory = defineError({
    status: 409,
    payload: z.object({ reason: z.string() }),
    toResponse: (body) => Response.json(body, { status: 409 }),
  })
  assignErrorName(factory as unknown as Parameters<typeof assignErrorName>[0], 'CONFLICT_ERROR')
  return factory
}

describe('error factory (runtime)', () => {
  it('creates tagged error instances with name, status and error', () => {
    const factory = conflictFactory()
    const thrown = factory({ reason: 'taken' }) as unknown as {
      name: string
      status: number
      error: unknown
      message: string
    }

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.name).toBe('CONFLICT_ERROR')
    expect(thrown.status).toBe(409)
    expect(thrown.error).toEqual({ reason: 'taken' })
  })

  it('is detectable as a factory and collects names from registry', () => {
    const factory = defineError({ status: 409, payload: z.object({ reason: z.string() }) })
    expect(isErrorFactory(factory)).toBe(true)

    const route = asRoute(get('/x').handle(() => ({ ok: true })))
    collectDeclarations({ Conflict: factory as never, ep: route as never })
    const thrown = factory({ reason: 'dup' }) as unknown as { name: string }
    expect(thrown.name).toBe('Conflict')
  })

  it('explicit name takes precedence over the registry export name', () => {
    const factory = defineError({
      name: 'CONFLICT',
      status: 409,
      payload: z.object({ reason: z.string() }),
    })
    collectDeclarations({ ExportedAs: factory as never })
    const thrown = factory({ reason: 'x' }) as unknown as { name: string }
    expect(thrown.name).toBe('CONFLICT')
  })
})

describe('onError handlers (runtime)', () => {
  beforeEach(() => clearErrorHandlers())

  it('route onError recovers a thrown error into a Response', async () => {
    const route = asRoute(
      get('/boom')
        .handle(() => {
          throw createError('INTERNAL_ERROR', 500, 'boom')
        })
        .onError((ctx) => Response.json({ caught: ctx.name }, { status: 418 })),
    )

    const response = await execute(route, request('/boom'))

    expect(response.status).toBe(418)
    expect(await response.json()).toEqual({ caught: 'INTERNAL_ERROR' })
  })

  it('middleware onError sees errors from the route', async () => {
    const mw = defineMiddleware(
      {
        onError: (ctx) => Response.json({ from: 'mw', name: ctx.name }, { status: 409 }),
      },
      '*',
    )
    const route = asRoute(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    const response = await execute(route, request('/boom'), { middlewares: [mw] })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ from: 'mw', name: 'INTERNAL_ERROR' })
  })

  it('global onError runs when no route/middleware handler responds', async () => {
    onError((ctx) => Response.json({ handled: ctx.name }, { status: 422 }))
    const route = asRoute(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    const response = await execute(route, request('/boom'))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ handled: 'INTERNAL_ERROR' })
  })

  it('global onError with deps only handles matching names', async () => {
    onError((ctx) => Response.json({ handled: ctx.name }, { status: 422 }), ['CONFLICT_ERROR'])
    const route = asRoute(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    await expect(execute(route, request('/boom'))).rejects.toMatchObject({
      name: 'INTERNAL_ERROR',
    })
  })

  it('global onError with empty deps handles any name, like no deps', async () => {
    onError((ctx) => Response.json({ handled: ctx.name }, { status: 422 }), [])
    const route = asRoute(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    const response = await execute(route, request('/boom'))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ handled: 'INTERNAL_ERROR' })
  })

  it('falls back to the factory toResponse when no handler responds', async () => {
    const factory = conflictFactory()
    const route = asRoute(
      get('/conflict').handle(() => {
        throw factory({ reason: 'taken' })
      }),
    )

    const response = await execute(route, request('/conflict'))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ reason: 'taken' })
  })

  it('exposes error info on the handler context', async () => {
    let seen: { name?: string; status?: number; stage?: string; error?: unknown } = {}
    const route = asRoute(
      get('/boom')
        .handle(() => {
          throw createError('INTERNAL_ERROR', 503, { why: 'down' })
        })
        .onError((ctx) => {
          seen = { name: ctx.name, status: ctx.status, stage: ctx.stage, error: ctx.payload }
          return new Response('handled')
        }),
    )

    await execute(route, request('/boom'))

    expect(seen.name).toBe('INTERNAL_ERROR')
    expect(seen.status).toBe(503)
    expect(seen.stage).toBe('handle')
    expect(seen.error).toEqual({ why: 'down' })
  })
})

describe('builtin errors (factory style)', () => {
  it('are factories that produce tagged instances', () => {
    const validation = ValidationError({ location: 'query', issues: [{ message: 'bad' }] })
    const v = validation as unknown as { name: string; status: number; error: object }
    expect(v.name).toBe('VALIDATION_ERROR')
    expect(v.status).toBe(400)
    expect(v.error).toEqual({ location: 'query', issues: [{ message: 'bad' }] })

    const parse = ParseError({ message: 'invalid json' })
    const p = parse as unknown as { name: string; status: number; error: object }
    expect(p.name).toBe('PARSE_ERROR')
    expect(p.status).toBe(400)

    const noHandler = NoHandlerError({ method: 'GET', path: '/x' })
    const n = noHandler as unknown as { name: string; status: number; error: object }
    expect(n.name).toBe('NO_HANDLER_ERROR')
    expect(n.status).toBe(500)
  })

  it('ValidationError falls back to a 400 response', async () => {
    const route = asRoute(
      get('/bad').handle(() => {
        throw ValidationError({ location: 'params', issues: [{ message: 'nope' }] })
      }),
    )

    const response = await execute(route, request('/bad'))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      name: 'VALIDATION_ERROR',
      location: 'params',
    })
  })

  it('ParseError falls back to a 400 response', async () => {
    const badJson = new Request('http://localhost/body', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    })
    const route = asRoute(get('/body').handle(() => ({ ok: true })))

    const response = await execute(route, badJson)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ name: 'PARSE_ERROR' })
  })

  it('NoHandlerError falls back to a 500 response', async () => {
    const route = asRoute(get('/nohandler'))

    const response = await execute(route, request('/nohandler'))

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ name: 'NO_HANDLER_ERROR' })
  })
})
