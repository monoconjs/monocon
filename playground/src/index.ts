import { get } from 'monocon'
import { z } from 'zod'

export const getUser = get('/users/:id', {
  response: z.object({ data: z.object({ id: z.string() }) }),
  meta: {
    tags: ['Users'],
  },
})
  .handle((ctx) => ({
    data: { id: ctx.params.id },
  }))
  .afterHandle((ctx) => ({ data: { id: ctx.params.id } }))

console.log(getUser)
