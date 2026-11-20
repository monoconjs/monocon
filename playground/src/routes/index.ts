import { all, get, head, options } from 'monocon'

export * from './users.ts'

export const adminUsers = get('/admin/users').handle((ctx) => ({
  user: ctx.user,
  role: ctx.role,
}))

export const headRoot = head('/').handle(() => undefined)
export const optionsRoot = options('/').handle(() => ({ allow: 'GET, POST' }))
export const fallback = all('*').handle(() => ({ notFound: true }))
