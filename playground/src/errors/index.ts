import { error } from 'monocon'
import { z } from 'zod'

export const CustomError = error({
  name: 'CUSTOM_ERROR',
  status: 500,
  payload: z.object({ path: z.string() }),
  toResponse(payload) {
    return Response.json(payload, { status: 500 })
  },
})

// onError(
//   (ctx) => {
//     if (ctx.name === 'CustomError') {
//       return ctx.json({ type: ctx.name, by: 'onError' }, { status: ctx.status })
//     }
//     return undefined
//   },
//   ['CustomError'],
// )

// onError((ctx) => {
//   if (ctx.name === 'CustomError') {
//     return ctx.json({ type: ctx.name, by: 'onError global' }, { status: ctx.status })
//   }
//   return undefined
// })
