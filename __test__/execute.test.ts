import { z } from 'zod'

import { execute } from '../packages/core/src/execute.ts'
import type { RuntimeMiddleware } from '../packages/core/src/middleware.ts'
import type { RuntimeRoute } from '../packages/core/src/route.ts'
import { get } from '../src/index.ts'
import { middleware } from '../src/index.ts'

function asRoute(value: unknown): RuntimeRoute {
  return value as RuntimeRoute
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

    const route = asRoute(
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

    const response = await execute(route, request('/users/42'))

    expect(calls).toEqual(['onRequest', 'beforeHandle', 'handle', 'afterHandle', 'onResponse'])
    expect(await response.json()).toEqual({ ok: true, extra: 1 })
  })

  it('validates params and query, using parsed values in the handler', async () => {
    const route = asRoute(
      get('/users/:id', {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ page: z.coerce.number() }),
      }).handle((ctx) => ({
        id: ctx.params.id,
        page: ctx.query.page,
      })),
    )

    const response = await execute(route, request('/users/42?page=3'))

    expect(await response.json()).toEqual({ id: 42, page: 3 })
  })

  it('returns a 400 response when a schema fails', async () => {
    const route = asRoute(
      get('/users/:id', {
        params: z.object({ id: z.coerce.number() }),
      }).handle((ctx) => ({ id: ctx.params.id })),
    )

    const response = await execute(route, request('/users/abc'))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      name: 'VALIDATION_ERROR',
      location: 'params',
    })
  })

  it('parses a JSON body and validates it', async () => {
    const route = asRoute(
      get('/users', {
        body: z.object({ name: z.string() }),
      }).handle((ctx: { body: { name: string } }) => ({ name: ctx.body.name })),
    )

    const response = await execute(
      route,
      request('/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'alice' }),
      }),
    )

    expect(await response.json()).toEqual({ name: 'alice' })
  })

  it('runs matched middleware hooks around the route', async () => {
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
    const route = asRoute(
      get('/admin/users').handle((ctx) => {
        calls.push('handle')
        handlerCtx = ctx
        return { ok: true }
      }),
    )

    const response = await execute(route, request('/admin/users'), {
      middlewares: [logger, auth],
    })

    expect(calls).toEqual(['mw.onRequest', 'auth.beforeHandle', 'handle', 'mw.onResponse'])
    expect(handlerCtx).toMatchObject({ requestId: 'r1', user: 'alice' })
    expect(await response.json()).toEqual({ ok: true })
  })

  it('short-circuits when a hook returns a Response', async () => {
    const route = asRoute(
      get('/secret')
        .beforeHandle(() => new Response('denied', { status: 403 }))
        .handle(throwingHandler),
    )

    const response = await execute(route, request('/secret'))

    expect(response.status).toBe(403)
    expect(await response.text()).toBe('denied')
  })

  it('skips stages that are not registered', async () => {
    const route = asRoute(get('/health').handle(() => ({ status: 'ok' })))

    const response = await execute(route, request('/health'))

    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('skips body parsing when skipBody is set', async () => {
    let seenBody: unknown = 'unset'
    const route = asRoute(
      get('/missing').handle((ctx) => {
        seenBody = ctx.body
        return { ok: true }
      }),
    )

    const response = await execute(
      route,
      request('/missing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
      { skipBody: true },
    )

    expect(response.status).toBe(200)
    expect(seenBody).toBeUndefined()
  })
})
