import { z } from 'zod'

import { get } from '../src/index.ts'
import type { Endpoint, EndpointBuilder, EndpointState } from '../src/index.ts'

type BuilderMethods<Value> = Exclude<keyof Value, `~${string}`>

describe('endpoint builder', () => {
  it('chains stages in order', () => {
    const endpoint = get('/users/:id', {
      meta: { auth: true },
      params: z.object({ id: z.coerce.number() }),
      query: z.object({ page: z.coerce.number() }),
    })
      .onRequest(() => ({ traceId: 'trace' }))
      .beforeHandle((ctx) => {
        expectTypeOf(ctx.traceId).toEqualTypeOf<string>()
        expectTypeOf(ctx.params.id).toEqualTypeOf<number>()
        expectTypeOf(ctx.query.page).toEqualTypeOf<number>()

        return { user: 'alice' }
      })
      .handle((ctx) => {
        expectTypeOf(ctx.traceId).toEqualTypeOf<string>()
        expectTypeOf(ctx.user).toEqualTypeOf<string>()

        return { id: ctx.params.id }
      })
      .afterHandle(() => {})
      .onResponse((_ctx, response) => response)

    expectTypeOf(endpoint['~path']).toEqualTypeOf<'/users/:id'>()
    expectTypeOf(endpoint['~method']).toEqualTypeOf<'GET'>()
  })

  it('returns an Endpoint from handle', () => {
    const endpoint = get('/final').handle(() => 'ok')

    expectTypeOf(endpoint).toMatchTypeOf<Endpoint<'GET', '/final'>>()
  })

  it('allows skipping stages', () => {
    get('/health').handle(() => 'ok')
    get('/search', { query: z.object({ q: z.string() }) }).handle((ctx) => ctx.query.q)
    get('/direct')
      .beforeHandle(() => {})
      .handle(() => 'ok')
  })

  it('allows repeating stages', () => {
    get('/repeat')
      .onRequest(() => ({ first: 1 }))
      .onRequest(() => ({ second: 2 }))
      .handle((ctx) => {
        expectTypeOf(ctx.first).toEqualTypeOf<number>()
        expectTypeOf(ctx.second).toEqualTypeOf<number>()

        return 'ok'
      })
      .onResponse((_ctx, response) => response)
      .onResponse((_ctx, response) => response)
  })

  it('allows repeating afterHandle and onResponse', () => {
    const afterHandles = get('/after')
      .handle(() => 'ok')
      .afterHandle((_ctx, result) => result)
      .afterHandle((_ctx, result) => result)

    expectTypeOf<BuilderMethods<typeof afterHandles>>().toEqualTypeOf<
      'afterHandle' | 'onResponse' | 'onError'
    >()

    const responses = get('/response')
      .handle(() => 'ok')
      .onResponse((_ctx, response) => response)
      .onResponse((_ctx, response) => response)

    expectTypeOf<BuilderMethods<typeof responses>>().toEqualTypeOf<'onResponse' | 'onError'>()

    const mixed = get('/mixed')
      .handle(() => 'ok')
      .afterHandle((_ctx, result) => result)
      .onResponse((_ctx, response) => response)
      .onResponse((_ctx, response) => response)

    expectTypeOf<BuilderMethods<typeof mixed>>().toEqualTypeOf<'onResponse' | 'onError'>()
  })

  it('rejects going backwards', () => {
    const afterBeforeHandle = get('/b').beforeHandle(() => {})
    // @ts-expect-error onRequest is unavailable after beforeHandle
    afterBeforeHandle.onRequest(() => {})

    const afterHandle = get('/c').handle(() => 'ok')
    // @ts-expect-error onRequest is unavailable after handle
    afterHandle.onRequest(() => {})

    const afterFirstHandle = get('/d').handle(() => 'ok')
    // @ts-expect-error handle is unavailable after handle
    afterFirstHandle.handle(() => 'ok')

    const fresh = get('/e')
    // @ts-expect-error afterHandle is unavailable before handle
    fresh.afterHandle(() => {})

    type AfterHandle = EndpointBuilder<'handle', EndpointState<'GET', '/f'>>
    expectTypeOf<keyof AfterHandle>().toEqualTypeOf<'afterHandle' | 'onResponse' | 'onError'>()
  })
})
