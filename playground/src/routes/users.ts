import { defineGroup } from 'monocon'
import { z } from 'zod'

import { CustomError } from '../errors/index.ts'

const { del, get, patch, post, put } = defineGroup('/users', {})

export const getUser = get('/:id', {
  params: z.object({ id: z.coerce.number() }),
  query: z.object({ page: z.coerce.number().default(1) }),
  response: z.object({
    data: z.object({ id: z.number(), name: z.string() }),
  }),
  meta: { tags: ['Users'] },
})
  .onRequest(() => ({ traceId: 'trace-1' }))
  .beforeHandle((ctx) => ({ requestedBy: ctx.traceId }))
  .handle((ctx) => {
    void ctx.requestId
    throw CustomError({ path: ctx.url.toString() })
    // return {
    //   data: { id: ctx.params.id, name: ctx.requestedBy, _id: ctx.requestId },
    // }
  })
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)

export const createUser = post('', {
  body: z.object({ name: z.string(), email: z.string() }),
  response: z.object({ id: z.number(), name: z.string() }),
  meta: { tags: ['Users'] },
}).handle((ctx) => ({ id: 1, name: ctx.body.name }))

export const health = get('/health').handle(() => ({ status: 'ok' }))

export const updateUser = put('/:id', {
  params: z.object({ id: z.coerce.number() }),
}).handle((ctx) => ({ id: ctx.params.id }))

export const deleteUser = del('/:id').handle(() => ({ ok: true }))
export const patchUser = patch('/:id').handle(() => ({ ok: true }))
