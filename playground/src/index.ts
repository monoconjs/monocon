import { all, del, get, head, options, patch, post, put } from 'monocon'
import { z } from 'zod'

import { auth } from './middlewares/auth.ts'
import { logger } from './middlewares/logger.ts'

export const getUser = get('/users/:id', {
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
    data: { id: ctx.params.id, name: ctx.requestedBy, _id: ctx.requestId },
  }))
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)

export const createUser = post('/users', {
  body: z.object({ name: z.string(), email: z.string() }),
  response: z.object({ id: z.number(), name: z.string() }),
  meta: { tags: ['Users'] },
}).handle((ctx) => ({ id: 1, name: ctx.body.name }))

export const health = get('/health').handle(() => ({ status: 'ok' }))

export const adminUsers = get('/admin/users').handle((ctx) => ({
  user: ctx.user,
  role: ctx.role,
}))

export const updateUser = put('/users/:id', {
  params: z.object({ id: z.coerce.number() }),
}).handle((ctx) => ({ id: ctx.params.id }))

export const deleteUser = del('/users/:id').handle(() => ({ ok: true }))
export const patchUser = patch('/users/:id').handle(() => ({ ok: true }))
export const headRoot = head('/').handle(() => undefined)
export const optionsRoot = options('/').handle(() => ({ allow: 'GET, POST' }))
export const fallback = all('*').handle(() => ({ notFound: true }))

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
