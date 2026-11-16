import { middleware } from '../src/index.ts'

describe('middleware types', () => {
  it('keeps the pattern literal type', () => {
    const auth = middleware('/admin/*', { onRequest: () => ({ userId: 'u1' }) })

    expectTypeOf(auth['~pattern']).toEqualTypeOf<'/admin/*'>()
  })

  it('keeps the include/exclude pattern shape', () => {
    const auth = middleware({ include: ['/admin/*'], exclude: ['/admin/public/*'] }, {})

    expectTypeOf(auth['~pattern']).toEqualTypeOf<{
      readonly include: readonly ['/admin/*']
      readonly exclude: readonly ['/admin/public/*']
    }>()
  })

  it('derives provided from hooks', () => {
    const auth = middleware('/admin/*', {
      onRequest: () => ({ userId: 'u1' }),
      beforeHandle: () => ({ role: 'admin' }),
    })

    expectTypeOf(auth['~provided']).toEqualTypeOf<{
      userId: string
      role: string
    }>()
  })

  it('leaves provided empty when hooks return nothing', () => {
    const logger = middleware('*', { onRequest: () => ({}) })

    expectTypeOf(logger['~provided']).toEqualTypeOf<{}>()
  })
})
