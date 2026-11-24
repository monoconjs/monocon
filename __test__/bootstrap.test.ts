import { z } from 'zod'

import { createFetchHandler } from '../packages/core/src/fetch-handler.ts'
import { createMatcher } from '../packages/core/src/matcher.ts'
import type { RuntimeMiddleware } from '../packages/core/src/middleware.ts'
import type { RuntimeRoute } from '../packages/core/src/route.ts'
import { get, post } from '../src/index.ts'
import { defineMiddleware } from '../src/index.ts'

function asRoute(value: unknown): RuntimeRoute {
  return value as RuntimeRoute
}

function asMiddleware(value: unknown): RuntimeMiddleware {
  return value as RuntimeMiddleware
}

describe('createFetchHandler', () => {
  it('returns 404 for an unmatched route', async () => {
    const handler = createFetchHandler(createMatcher([]), [])

    const response = await handler(new Request('http://localhost/missing'))

    expect(response.status).toBe(404)
  })

  it('returns 404 for an unmatched route with an invalid JSON body', async () => {
    const handler = createFetchHandler(createMatcher([]), [])
    const request = new Request('http://localhost/missing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    })

    const response = await handler(request)

    expect(response.status).toBe(404)
  })

  it('still parses the body of a matched route with an invalid JSON body', async () => {
    const route = asRoute(post('/health').handle(() => ({ ok: true })))
    const handler = createFetchHandler(createMatcher([route]), [])
    const request = new Request('http://localhost/health', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    })

    const response = await handler(request)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ name: 'PARSE_ERROR' })
  })

  it('executes the matched route and returns its response', async () => {
    const route = asRoute(get('/health').handle(() => ({ status: 'ok' })))
    const handler = createFetchHandler(createMatcher([route]), [])

    const response = await handler(new Request('http://localhost/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('converts ValidationError into a 400 response', async () => {
    const route = asRoute(
      get('/users/:id').handle((ctx) => ({ id: ctx.params.id }), {
        params: z.object({ id: z.coerce.number() }),
      }),
    )
    const handler = createFetchHandler(createMatcher([route]), [])

    const response = await handler(new Request('http://localhost/users/abc'))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      name: 'VALIDATION_ERROR',
      location: 'params',
    })
  })

  it('applies matched middleware hooks', async () => {
    const logger = asMiddleware(defineMiddleware({ onRequest: () => ({ requestId: 'r1' }) }, '*'))
    let seen: unknown
    const route = asRoute(
      get('/health').handle((ctx) => {
        seen = ctx
        return { ok: true }
      }),
    )
    const handler = createFetchHandler(createMatcher([route]), [logger])

    await handler(new Request('http://localhost/health'))

    expect(seen).toMatchObject({ requestId: 'r1' })
  })

  it('runs global middleware onResponse hooks for an unmatched route', async () => {
    const header = asMiddleware(
      defineMiddleware(
        {
          onResponse: (_ctx, response) => {
            response.headers.set('x-trace', 'r1')
            return response
          },
        },
        '*',
      ),
    )
    const handler = createFetchHandler(createMatcher([]), [header])

    const response = await handler(new Request('http://localhost/missing'))

    expect(response.status).toBe(404)
    expect(response.headers.get('x-trace')).toBe('r1')
  })

  it('runs onRequest hooks for an unmatched route', async () => {
    let seen = false
    const probe = asMiddleware(
      defineMiddleware(
        {
          onRequest: () => {
            seen = true
          },
        },
        '*',
      ),
    )
    const handler = createFetchHandler(createMatcher([]), [probe])

    await handler(new Request('http://localhost/missing'))

    expect(seen).toBe(true)
  })
})
