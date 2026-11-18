import { defineMiddleware } from 'monocon'

export const logger = defineMiddleware(
  {
    onRequest: () => ({ requestId: 'req-1' }),
    onResponse: (_ctx, response) => response,
  },
  '*',
)
