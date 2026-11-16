import { all, del, get, head, middleware, options, patch, post, put } from 'monocon'
import { z } from 'zod'

const logger = middleware('*', {
  onRequest: () => ({ requestId: 'req-1' }),
  onResponse: (_ctx, response) => response,
})

const auth = middleware(
  { include: ['/admin/*'], exclude: ['/admin/public/*'] },
  {
    onRequest: () => ({ user: 'alice', role: 'admin' as const }),
    beforeHandle: () => ({ checkedAt: Date.now() }),
  },
)

const getUser = get('/users/:id', {
  params: z.object({ id: z.coerce.number() }),
  query: z.object({ page: z.coerce.number().default(1) }),
  response: z.object({
    data: z.object({ id: z.number(), name: z.string() }),
  }),
  meta: { tags: ['Users'] },
})
  .onRequest(() => ({ traceId: 'trace-1' }))
  .beforeHandle((ctx) => ({ requestedBy: ctx.traceId }))
  .handle((ctx) => ({
    data: { id: ctx.params.id, name: ctx.requestedBy },
  }))
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)

const createUser = post('/users', {
  body: z.object({ name: z.string(), email: z.string() }),
  response: z.object({ id: z.number(), name: z.string() }),
  meta: { tags: ['Users'] },
}).handle((ctx) => ({ id: 1, name: ctx.body.name }))

const health = get('/health').handle(() => ({ status: 'ok' }))

const updateUser = put('/users/:id', {
  params: z.object({ id: z.coerce.number() }),
}).handle((ctx) => ({ id: ctx.params.id }))

const deleteUser = del('/users/:id').handle(() => ({ ok: true }))
const patchUser = patch('/users/:id').handle(() => ({ ok: true }))
const headRoot = head('/').handle(() => undefined)
const optionsRoot = options('/').handle(() => ({ allow: 'GET, POST' }))
const fallback = all('*').handle(() => ({ notFound: true }))

console.log({
  logger,
  auth,
  getUser,
  createUser,
  health,
  updateUser,
  deleteUser,
  patchUser,
  headRoot,
  optionsRoot,
  fallback,
})
