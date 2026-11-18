import { defineMiddleware } from '../src/index.ts'

describe('middleware types', () => {
  it('keeps the pattern literal type', () => {
    const auth = defineMiddleware({ onRequest: () => ({ userId: 'u1' }) }, '/admin/*')

    expectTypeOf(auth['~pattern']).toEqualTypeOf<'/admin/*'>()
  })

  it('keeps the include/exclude pattern shape', () => {
    const auth = defineMiddleware({}, { include: ['/admin/*'], exclude: ['/admin/public/*'] })

    expectTypeOf(auth['~pattern']).toEqualTypeOf<{
      readonly include: readonly ['/admin/*']
      readonly exclude: readonly ['/admin/public/*']
    }>()
  })

  it('derives provided from hooks', () => {
    const auth = defineMiddleware(
      {
        onRequest: () => ({ userId: 'u1' }),
        beforeHandle: () => ({ role: 'admin' }),
      },
      '/admin/*',
    )

    expectTypeOf(auth['~provided']).toEqualTypeOf<{
      userId: string
      role: string
    }>()
  })

  it('leaves provided empty when hooks return nothing', () => {
    const logger = defineMiddleware({ onRequest: () => ({}) }, '*')

    expectTypeOf(logger['~provided']).toEqualTypeOf<{}>()
  })
})
