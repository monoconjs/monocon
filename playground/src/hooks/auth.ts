import { defineInject } from 'monocon'

export const auth = defineInject(() => ({
  beforeHandle: () => ({ user: 'admin' }),
}))
