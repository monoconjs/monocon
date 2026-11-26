import { inject } from 'monocon'
import { z } from 'zod'

export const META = {
  prefix: '/api/users',
  summary: 'User routes',
} as const satisfies Meta

export const INJECTS = inject({
  tenant: {
    beforeHandle: () => ({ tenantId: 'tenant-1' }),
  },
})

export const getUser = get(
  '/:id',
  (ctx) => {
    const id: string = ctx.params.id
    const user: string = ctx.user
    const tenantId: string = ctx.tenantId
    const page: number = ctx.query.page

    return ctx.json({ id, user, tenantId, page })
  },
  {
    params: z.object({ id: z.string() }),
    query: z.object({ page: z.coerce.number() }),
    response: z.object({
      id: z.string(),
      user: z.string(),
      tenantId: z.string(),
      page: z.number(),
    }),
  },
)

export const createUser = post(
  '/',
  (ctx) => {
    const name: string = ctx.body.name

    return ctx.json({ id: '1', name, user: ctx.user, tenantId: ctx.tenantId })
  },
  {
    body: z.object({ name: z.string() }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      user: z.string(),
      tenantId: z.string(),
    }),
  },
)

export const health = get('/health', (ctx) => ctx.json({ ok: true }), { auth: false })
