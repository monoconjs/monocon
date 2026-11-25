import type {
  Context,
  InjectContext,
  MetaPrefix,
  PathParams,
  ProvidedOfHook,
  RouteBuilder,
} from '@monocon/core'
import { z } from 'zod'

const auth = {
  beforeHandle: () => ({ user: 'admin' }),
}

const authFactory = () => ({
  beforeHandle: () => ({ user: 'admin' }),
})

expectTypeOf<PathParams<'/users/:id/posts/:postId'>>().toEqualTypeOf<{
  id: string
  postId: string
}>()
expectTypeOf<PathParams<'/files/*'>>().toEqualTypeOf<{ wildcard: string }>()

expectTypeOf<MetaPrefix<{ prefix: '/api' }>>().toEqualTypeOf<'/api'>()
expectTypeOf<MetaPrefix<{}>>().toEqualTypeOf<''>()

expectTypeOf<ProvidedOfHook<typeof auth.beforeHandle>>().toEqualTypeOf<{ user: string }>()
// oxlint-disable-next-line typescript/no-generated-empty-object-type
expectTypeOf<ProvidedOfHook<() => void>>().toEqualTypeOf<{}>()
expectTypeOf<InjectContext<{ auth: typeof auth }>>().toEqualTypeOf<{ user: string }>()
expectTypeOf<InjectContext<{ auth: typeof authFactory }>>().toEqualTypeOf<{ user: string }>()

expectTypeOf<Context<{ user: string }>['user']>().toEqualTypeOf<string>()

declare const get: RouteBuilder<{ prefix: '/api' }, { auth: typeof auth }>

const route = get(
  '/users/:id',
  (ctx) => {
    expectTypeOf(ctx.req).toEqualTypeOf<Request>()
    expectTypeOf(ctx.url).toEqualTypeOf<URL>()
    expectTypeOf(ctx.params.id).toEqualTypeOf<string>()
    expectTypeOf(ctx.user).toEqualTypeOf<string>()
    expectTypeOf(ctx.json({ ok: true })).toEqualTypeOf<Response>()
    return { ok: true }
  },
  { query: z.object({ page: z.coerce.number() }) },
)

expectTypeOf(route.path).toEqualTypeOf<'/api/users/:id'>()

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

get(
  '/private',
  (ctx) => {
    expectTypeOf(ctx).not.toHaveProperty('user')
    return { ok: true }
  },
  { auth: false },
)
