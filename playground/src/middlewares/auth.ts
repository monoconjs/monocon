import { middleware } from 'monocon'

export const auth = middleware(
  { include: ['/admin/*'], exclude: ['/admin/public/*'] },
  {
    onRequest: () => ({ user: 'alice', role: 'admin' as const }),
    beforeHandle: () => ({ checkedAt: Date.now() }),
  },
)
