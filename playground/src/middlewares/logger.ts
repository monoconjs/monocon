import { middleware } from 'monocon'

export const logger = middleware('*', {
  onRequest: () => ({ requestId: 'req-1' }),
  onResponse: (_ctx, response) => response,
})
