import { provide } from 'monocon'
import { z } from 'zod'

export const auth = provide(() => ({
  beforeHandle: (ctx) => {
    const authorization: string = ctx.headers.authorization

    return { user: authorization }
  },
  schema: {
    headers: z.object({
      authorization: z.string(),
    }),
  },
}))
