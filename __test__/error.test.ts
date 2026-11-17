import { z } from 'zod'

import type { RuntimeEndpoint } from '../src/endpoint.ts'
import { createError } from '../src/errors/index.ts'
import {
  NoHandlerError,
  ParseError,
  ValidationError,
  assignErrorName,
  clearErrorHandlers,
  collectDeclarations,
  error,
  execute,
  get,
  isErrorFactory,
  middleware,
  onError,
} from '../src/index.ts'

function asEndpoint(value: unknown): RuntimeEndpoint {
  return value as RuntimeEndpoint
}

function request(path: string): Request {
  return new Request(`http://localhost${path}`)
}

function conflictFactory() {
  const factory = error({
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
    const factory = error({ status: 409, payload: z.object({ reason: z.string() }) })
    expect(isErrorFactory(factory)).toBe(true)

    const endpoint = asEndpoint(get('/x').handle(() => ({ ok: true })))
    collectDeclarations({ Conflict: factory as never, ep: endpoint as never })
    const thrown = factory({ reason: 'dup' }) as unknown as { name: string }
    expect(thrown.name).toBe('Conflict')
  })

  it('explicit name takes precedence over the registry export name', () => {
    const factory = error({
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

  it('endpoint onError recovers a thrown error into a Response', async () => {
    const endpoint = asEndpoint(
      get('/boom')
        .handle(() => {
          throw createError('INTERNAL_ERROR', 500, 'boom')
        })
        .onError((ctx) => Response.json({ caught: ctx.name }, { status: 418 })),
    )

    const response = await execute(endpoint, request('/boom'))

    expect(response.status).toBe(418)
    expect(await response.json()).toEqual({ caught: 'INTERNAL_ERROR' })
  })

  it('middleware onError sees errors from the endpoint', async () => {
    const mw = middleware('*', {
      onError: (ctx) => Response.json({ from: 'mw', name: ctx.name }, { status: 409 }),
    })
    const endpoint = asEndpoint(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    const response = await execute(endpoint, request('/boom'), { middlewares: [mw] })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ from: 'mw', name: 'INTERNAL_ERROR' })
  })

  it('global onError runs when no endpoint/middleware handler responds', async () => {
    onError((ctx) => Response.json({ handled: ctx.name }, { status: 422 }))
    const endpoint = asEndpoint(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    const response = await execute(endpoint, request('/boom'))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ handled: 'INTERNAL_ERROR' })
  })

  it('global onError with deps only handles matching names', async () => {
    onError((ctx) => Response.json({ handled: ctx.name }, { status: 422 }), ['CONFLICT_ERROR'])
    const endpoint = asEndpoint(
      get('/boom').handle(() => {
        throw createError('INTERNAL_ERROR', 500, 'boom')
      }),
    )

    await expect(execute(endpoint, request('/boom'))).rejects.toMatchObject({
      name: 'INTERNAL_ERROR',
    })
  })

  it('falls back to the factory toResponse when no handler responds', async () => {
    const factory = conflictFactory()
    const endpoint = asEndpoint(
      get('/conflict').handle(() => {
        throw factory({ reason: 'taken' })
      }),
    )

    const response = await execute(endpoint, request('/conflict'))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ reason: 'taken' })
  })

  it('exposes error info on the handler context', async () => {
    let seen: { name?: string; status?: number; stage?: string; error?: unknown } = {}
    const endpoint = asEndpoint(
      get('/boom')
        .handle(() => {
          throw createError('INTERNAL_ERROR', 503, { why: 'down' })
        })
        .onError((ctx) => {
          seen = { name: ctx.name, status: ctx.status, stage: ctx.stage, error: ctx.payload }
          return new Response('handled')
        }),
    )

    await execute(endpoint, request('/boom'))

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
    const endpoint = asEndpoint(
      get('/bad').handle(() => {
        throw ValidationError({ location: 'params', issues: [{ message: 'nope' }] })
      }),
    )

    const response = await execute(endpoint, request('/bad'))

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
    const endpoint = asEndpoint(get('/body').handle(() => ({ ok: true })))

    const response = await execute(endpoint, badJson)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ name: 'PARSE_ERROR' })
  })

  it('NoHandlerError falls back to a 500 response', async () => {
    const endpoint = asEndpoint(get('/nohandler'))

    const response = await execute(endpoint, request('/nohandler'))

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ name: 'NO_HANDLER_ERROR' })
  })
})
