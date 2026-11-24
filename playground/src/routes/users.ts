import { defineGroup } from 'monocon'
import { z } from 'zod'

import { CustomError } from '../errors/index.ts'

const { del, get, patch, post, put } = defineGroup('/users', {})

export const getUser = get('/:id')
  .onRequest(() => ({ traceId: 'trace-1' }))
  .beforeHandle((ctx) => ({ requestedBy: ctx.traceId }), {
    params: z.object({ id: z.coerce.number() }),
    query: z.object({ page: z.coerce.number().default(1) }),
  })
  .handle(
    (ctx) => {
      void ctx.params.id
      void ctx.query.page
      void ctx.requestId
      throw CustomError({ path: ctx.url.toString() })
      // return {
      //   data: { id: ctx.params.id, name: ctx.requestedBy, _id: ctx.requestId },
      // }
    },
    {
      response: z.object({
        data: z.object({ id: z.number(), name: z.string() }),
      }),
    },
  )
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)

export const createUser = post('', { tags: ['Users'] }).handle(
  (ctx) => ({ id: 1, name: ctx.body.name }),
  {
    body: z.object({ name: z.string(), email: z.string() }),
    response: z.object({ id: z.number(), name: z.string() }),
  },
)

export const health = get('/health').handle(() => ({ status: 'ok' }))

export const updateUser = put('/:id').handle((ctx) => ({ id: ctx.params.id }), {
  params: z.object({ id: z.coerce.number() }),
})

export const deleteUser = del('/:id').handle(() => ({ ok: true }))
export const patchUser = patch('/:id').handle(() => ({ ok: true }))
