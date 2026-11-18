import { defineMiddleware } from 'monocon'

export const auth = defineMiddleware(
  {
    onRequest: () => ({ user: 'alice', role: 'admin' as const }),
    beforeHandle: () => ({ checkedAt: Date.now() }),
  },
  { include: ['/admin/*'], exclude: ['/admin/public/*'] },
)
