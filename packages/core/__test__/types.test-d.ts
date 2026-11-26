import type {
  Context,
  Meta,
  MetaPrefix,
  PathParams,
  InjectContext,
  ProvidedOfHook,
  RouteBuilder,
  RouteMeta,
} from '@monocon/core'
import { inject, meta, provide } from '@monocon/core'
import { z } from 'zod'

const auth = {
  beforeHandle: () => ({ user: 'admin' }),
}

const authFactory = () => ({
  beforeHandle: () => ({ user: 'admin' }),
})

declare const get: RouteBuilder<{ prefix: '/api' }, { auth: typeof auth }>

declare global {
  interface RouteRecords {
    '/api/users/:id': { get: unknown }
  }
}

describe('core types', () => {
  it('infers path params', () => {
    expectTypeOf<PathParams<'/users/:id/posts/:postId'>>().toEqualTypeOf<{
      id: string
      postId: string
    }>()
    expectTypeOf<PathParams<'/files/*'>>().toEqualTypeOf<{ wildcard: string }>()
  })

  it('infers meta types', () => {
    expectTypeOf<Meta['prefix']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<MetaPrefix<{ prefix: '/api' }>>().toEqualTypeOf<'/api'>()
    expectTypeOf<MetaPrefix<{}>>().toEqualTypeOf<''>()
    expectTypeOf<RouteMeta<{ prefix: '/api'; summary: string }>>().toEqualTypeOf<{
      summary: string
    }>()
  })

  it('creates meta definitions with inferred literals', () => {
    const value = meta({ prefix: '/api/users', summary: 'User routes' })

    expectTypeOf<MetaPrefix<typeof value>>().toEqualTypeOf<'/api/users'>()
    expectTypeOf<RouteMeta<typeof value>>().toEqualTypeOf<{ readonly summary: 'User routes' }>()
  })

  it('infers hook-provided context', () => {
    expectTypeOf<ProvidedOfHook<typeof auth.beforeHandle>>().toEqualTypeOf<{ user: string }>()
    // oxlint-disable-next-line typescript/no-generated-empty-object-type
    expectTypeOf<ProvidedOfHook<() => void>>().toEqualTypeOf<{}>()
    expectTypeOf<InjectContext<{ auth: typeof auth }>>().toEqualTypeOf<{ user: string }>()
    expectTypeOf<InjectContext<{ auth: typeof authFactory }>>().toEqualTypeOf<{ user: string }>()
    expectTypeOf<Context<{ user: string }>['user']>().toEqualTypeOf<string>()
  })

  it('defines providers with inferred context', () => {
    const defined = provide(() => ({
      beforeHandle: (ctx) => {
        expectTypeOf(ctx.req).toEqualTypeOf<Request>()
        return { user: 'admin' }
      },
    }))

    expectTypeOf<InjectContext<{ defined: typeof defined }>>().toEqualTypeOf<{ user: string }>()

    const definedHooks = provide({ beforeHandle: () => ({ tenantId: 'tenant-1' }) })

    expectTypeOf<InjectContext<{ definedHooks: typeof definedHooks }>>().toEqualTypeOf<{
      tenantId: string
    }>()
  })

  it('infers hook context from the hook schema', () => {
    const hook = provide({
      schema: {
        headers: z.object({ authorization: z.string() }),
        query: z.object({ page: z.coerce.number() }),
        response: z.object({ ok: z.boolean() }),
      },
      beforeHandle: (ctx) => {
        expectTypeOf(ctx.headers.authorization).toEqualTypeOf<string>()
        expectTypeOf(ctx.query.page).toEqualTypeOf<number>()
        return { user: 'admin' }
      },
      afterHandle: (ctx, result) => {
        expectTypeOf(ctx.headers.authorization).toEqualTypeOf<string>()
        expectTypeOf(result).toEqualTypeOf<{ ok: boolean } | Response>()
        return result
      },
    })

    expectTypeOf<InjectContext<{ hook: typeof hook }>>().toEqualTypeOf<{ user: string }>()
    inject({ hook })
  })

  it('infers factory hook context from the hook schema', () => {
    const factory = provide(() => ({
      schema: { body: z.object({ token: z.string() }) },
      beforeHandle: (ctx) => {
        expectTypeOf(ctx.body.token).toEqualTypeOf<string>()
        return { user: 'admin' }
      },
    }))

    expectTypeOf<InjectContext<{ factory: typeof factory }>>().toEqualTypeOf<{ user: string }>()
  })

  it('infers provider schemas in route context', () => {
    const provider = provide({
      schema: {
        headers: z.object({ authorization: z.string() }),
        query: z.object({ page: z.coerce.number() }),
        response: z.object({ ok: z.boolean() }),
      },
      beforeHandle: () => ({ user: 'admin' }),
    })

    const secureGet = undefined as unknown as RouteBuilder<{}, { provider: typeof provider }>

    secureGet('/secure', (ctx) => {
      expectTypeOf(ctx.headers.authorization).toEqualTypeOf<string>()
      expectTypeOf(ctx.query.page).toEqualTypeOf<number>()
      expectTypeOf(ctx.user).toEqualTypeOf<string>()
      // @ts-expect-error response must match the provider response schema
      ctx.json({ ok: 'yes' })
      return ctx.json({ ok: true })
    })

    secureGet(
      '/public',
      (ctx) => {
        expectTypeOf(ctx.headers).toEqualTypeOf<Headers>()
        return { ok: true }
      },
      { provider: false },
    )

    secureGet(
      '/override',
      (ctx) => {
        expectTypeOf(ctx.headers['x-tenant']).toEqualTypeOf<string>()
        expectTypeOf(ctx.headers).not.toHaveProperty('authorization')
        return { ok: true }
      },
      { headers: z.object({ 'x-tenant': z.string() }) },
    )
  })

  it('creates type-safe inject registries', () => {
    const registry = inject({
      __global: true,
      auth: provide(() => ({ beforeHandle: () => ({ user: 'admin' }) })),
    })

    expectTypeOf(registry.__global).toEqualTypeOf<true>()
    expectTypeOf<InjectContext<Omit<typeof registry, '__global'>>>().toEqualTypeOf<{
      user: string
    }>()

    // @ts-expect-error registry values must be providers
    inject({ invalid: 1 })
  })

  it('infers route context and path', () => {
    const route = get(
      '/users/:id',
      (ctx) => {
        expectTypeOf(ctx.req).toEqualTypeOf<Request>()
        expectTypeOf(ctx.url).toEqualTypeOf<URL>()
        expectTypeOf(ctx.params.id).toEqualTypeOf<string>()
        expectTypeOf(ctx.user).toEqualTypeOf<string>()
        expectTypeOf(ctx.meta).toEqualTypeOf<{ tag: string }>()
        expectTypeOf(ctx.json({ ok: true })).toEqualTypeOf<Response>()
        expectTypeOf(ctx.redirect).parameter(0).toEqualTypeOf<'/api/users/:id'>()
        return { ok: true }
      },
      { query: z.object({ page: z.coerce.number() }), meta: { tag: 'user' } },
    )

    expectTypeOf(route.path).toEqualTypeOf<'/api/users/:id'>()
  })

  it('infers schema options', () => {
    get(
      '/search',
      (ctx) => {
        expectTypeOf(ctx.query.page).toEqualTypeOf<number>()
        return { ok: true }
      },
      { query: z.object({ page: z.coerce.number() }) },
    )

    get(
      '/items',
      (ctx) => {
        expectTypeOf(ctx.body.name).toEqualTypeOf<string>()
        return { ok: true }
      },
      { body: z.object({ name: z.string() }) },
    )
  })

  it('rejects unknown route options', () => {
    // @ts-expect-error unknown option keys are not allowed
    get('/unknown-option', () => ({ ok: true }), { unknownKey: 1 })

    // @ts-expect-error unknown inject names are not allowed
    get('/unknown-inject', () => ({ ok: true }), { missing: false })
  })

  it('allows disabling a provider', () => {
    get(
      '/private',
      (ctx) => {
        expectTypeOf(ctx).not.toHaveProperty('user')
        return { ok: true }
      },
      { auth: false },
    )
  })
})
