import { z } from 'zod'

import { collectDeclarations, createFetchHandler } from '../src/bootstrap.ts'
import type { RuntimeEndpoint } from '../src/endpoint.ts'
import { get } from '../src/index.ts'
import { middleware } from '../src/index.ts'
import { createMatcher } from '../src/matcher.ts'
import type { RuntimeMiddleware } from '../src/middleware.ts'

function asEndpoint(value: unknown): RuntimeEndpoint {
  return value as RuntimeEndpoint
}

function asMiddleware(value: unknown): RuntimeMiddleware {
  return value as RuntimeMiddleware
}

describe('collectDeclarations', () => {
  it('separates endpoints from middlewares in a registry namespace', () => {
    const endpoint = asEndpoint(get('/health').handle(() => ({ ok: true })))
    const logger = asMiddleware(middleware('*', { onRequest: () => ({ id: 'r1' }) }))
    const registry = { health: endpoint, logger, version: '1.0.0', sum: () => 1 }

    const result = collectDeclarations(registry)

    expect(result.endpoints).toEqual([endpoint])
    expect(result.middlewares).toEqual([logger])
  })

  it('returns empty collections for an empty registry', () => {
    expect(collectDeclarations({})).toEqual({ endpoints: [], middlewares: [] })
  })
})

describe('createFetchHandler', () => {
  it('returns 404 for an unmatched route', async () => {
    const handler = createFetchHandler(createMatcher([]), [])

    const response = await handler(new Request('http://localhost/missing'))

    expect(response.status).toBe(404)
  })

  it('executes the matched endpoint and returns its response', async () => {
    const endpoint = asEndpoint(get('/health').handle(() => ({ status: 'ok' })))
    const handler = createFetchHandler(createMatcher([endpoint]), [])

    const response = await handler(new Request('http://localhost/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('converts ValidationError into a 400 response', async () => {
    const endpoint = asEndpoint(
      get('/users/:id', {
        params: z.object({ id: z.coerce.number() }),
      }).handle((ctx) => ({ id: ctx.params.id })),
    )
    const handler = createFetchHandler(createMatcher([endpoint]), [])

    const response = await handler(new Request('http://localhost/users/abc'))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      name: 'VALIDATION_ERROR',
      location: 'params',
    })
  })

  it('applies matched middleware hooks', async () => {
    const logger = asMiddleware(middleware('*', { onRequest: () => ({ requestId: 'r1' }) }))
    let seen: unknown
    const endpoint = asEndpoint(
      get('/health').handle((ctx) => {
        seen = ctx
        return { ok: true }
      }),
    )
    const handler = createFetchHandler(createMatcher([endpoint]), [logger])

    await handler(new Request('http://localhost/health'))

    expect(seen).toMatchObject({ requestId: 'r1' })
  })

  it('runs global middleware onResponse hooks for an unmatched route', async () => {
    const header = asMiddleware(
      middleware('*', {
        onResponse: (_ctx, response) => {
          response.headers.set('x-trace', 'r1')
          return response
        },
      }),
    )
    const handler = createFetchHandler(createMatcher([]), [header])

    const response = await handler(new Request('http://localhost/missing'))

    expect(response.status).toBe(404)
    expect(response.headers.get('x-trace')).toBe('r1')
  })

  it('runs onRequest hooks for an unmatched route', async () => {
    let seen = false
    const probe = asMiddleware(
      middleware('*', {
        onRequest: () => {
          seen = true
        },
      }),
    )
    const handler = createFetchHandler(createMatcher([]), [probe])

    await handler(new Request('http://localhost/missing'))

    expect(seen).toBe(true)
  })
})
