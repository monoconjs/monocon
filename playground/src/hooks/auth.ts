import { provide } from 'monocon'

export const auth = provide(() => ({
  beforeHandle: () => ({ user: 'admin' }),
}))
