// oxlint-disable typescript/no-unsafe-type-assertion
import { z } from 'zod'

import type { RuntimeEndpoint } from '../src/endpoint.ts'
import { execute } from '../src/index.ts'
import { get } from '../src/index.ts'
import { middleware } from '../src/index.ts'
import { ValidationError } from '../src/index.ts'
import type { RuntimeMiddleware } from '../src/middleware.ts'

function asEndpoint(value: unknown): RuntimeEndpoint {
  return value as RuntimeEndpoint
}

function asMiddleware(value: unknown): RuntimeMiddleware {
  return value as RuntimeMiddleware
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init)
}

function throwingHandler(): never {
  throw new Error('handler should not run')
}

describe('execute', () => {
  it('runs the full lifecycle in order and merges provided values', async () => {
    const calls: string[] = []

    const endpoint = asEndpoint(
      get('/users/:id')
        .onRequest(() => {
          calls.push('onRequest')
          return { traceId: 't1' }
        })
        .beforeHandle((ctx) => {
          calls.push('beforeHandle')
          expect(ctx.traceId).toBe('t1')
          return { role: 'admin' }
        })
        .handle((ctx) => {
          calls.push('handle')
          expect(ctx.params.id).toBe('42')
          expect(ctx.role).toBe('admin')
          return { ok: true }
        })
        .afterHandle((_ctx, result) => {
          calls.push('afterHandle')
          return { ...(result as object), extra: 1 }
        })
        .onResponse((_ctx, response) => {
          calls.push('onResponse')
          return response
        }),
    )

    const response = await execute(endpoint, request('/users/42'))

    expect(calls).toEqual(['onRequest', 'beforeHandle', 'handle', 'afterHandle', 'onResponse'])
    expect(await response.json()).toEqual({ ok: true, extra: 1 })
  })

  it('validates params and query, using parsed values in the handler', async () => {
    const endpoint = asEndpoint(
      get('/users/:id', {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ page: z.coerce.number() }),
      }).handle((ctx) => ({
        id: ctx.params.id,
        page: ctx.query.page,
      })),
    )

    const response = await execute(endpoint, request('/users/42?page=3'))

    expect(await response.json()).toEqual({ id: 42, page: 3 })
  })

  it('throws ValidationError when a schema fails', async () => {
    const endpoint = asEndpoint(
      get('/users/:id', {
        params: z.object({ id: z.coerce.number() }),
      }).handle((ctx) => ({ id: ctx.params.id })),
    )

    await expect(execute(endpoint, request('/users/abc'))).rejects.toBeInstanceOf(ValidationError)
    await expect(execute(endpoint, request('/users/abc'))).rejects.toMatchObject({
      location: 'params',
    })
  })

  it('parses a JSON body and validates it', async () => {
    const endpoint = asEndpoint(
      get('/users', {
        body: z.object({ name: z.string() }),
      }).handle((ctx: { body: { name: string } }) => ({ name: ctx.body.name })),
    )

    const response = await execute(
      endpoint,
      request('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'alice' }),
      }),
    )

    expect(await response.json()).toEqual({ name: 'alice' })
  })

  it('runs matched middleware hooks around the endpoint', async () => {
    const calls: string[] = []
    let handlerCtx: unknown
    const logger = asMiddleware(
      middleware('*', {
        onRequest: () => {
          calls.push('mw.onRequest')
          return { requestId: 'r1' }
        },
        onResponse: (_ctx, response) => {
          calls.push('mw.onResponse')
          return response
        },
      }),
    )
    const auth = asMiddleware(
      middleware('/admin/*', {
        beforeHandle: () => {
          calls.push('auth.beforeHandle')
          return { user: 'alice' }
        },
      }),
    )
    const endpoint = asEndpoint(
      get('/admin/users').handle((ctx) => {
        calls.push('handle')
        handlerCtx = ctx
        return { ok: true }
      }),
    )

    const response = await execute(endpoint, request('/admin/users'), {
      middlewares: [logger, auth],
    })

    expect(calls).toEqual(['mw.onRequest', 'auth.beforeHandle', 'handle', 'mw.onResponse'])
    expect(handlerCtx).toMatchObject({ requestId: 'r1', user: 'alice' })
    expect(await response.json()).toEqual({ ok: true })
  })

  it('short-circuits when a hook returns a Response', async () => {
    const endpoint = asEndpoint(
      get('/secret')
        .beforeHandle(() => new Response('denied', { status: 403 }))
        .handle(throwingHandler),
    )

    const response = await execute(endpoint, request('/secret'))

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('denied')
  })

  it('skips stages that are not registered', async () => {
    const endpoint = asEndpoint(get('/health').handle(() => ({ status: 'ok' })))

    const response = await execute(endpoint, request('/health'))

    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
