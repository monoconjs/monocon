import { z } from 'zod'

export const META = {
  prefix: '/api/posts',
  summary: 'Post routes',
} as const

export const listPosts = get(
  '/',
  (ctx) => {
    const user: string = ctx.user

    return ctx.json({ user, posts: [] as string[] })
  },
  {
    response: z.object({
      user: z.string(),
      posts: z.array(z.string()),
    }),
  },
)
