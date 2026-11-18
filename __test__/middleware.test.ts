import type { RuntimeMiddleware } from '../packages/core/src/middleware.ts'
import * as monocon from '../src/index.ts'

const onRequest = () => ({ requestId: 'r1' })
const beforeHandle = () => ({ userId: 1 })
const afterHandle = () => undefined
const onResponse = () => undefined

function isRuntimeMiddleware(value: object): value is RuntimeMiddleware {
  return '~pattern' in value && '~hooks' in value
}

function asRuntime(value: object): RuntimeMiddleware {
  if (!isRuntimeMiddleware(value)) {
    throw new TypeError('Expected a runtime middleware')
  }
  return value
}

describe('middleware', () => {
  it('stores a string pattern', () => {
    const logged = asRuntime(monocon.middleware('/admin/*', {}))

    expect(logged['~pattern']).toBe('/admin/*')
  })

  it('stores an include/exclude pattern', () => {
    const pattern = { include: ['/admin/*'], exclude: ['/admin/public/*'] }
    const auth = asRuntime(monocon.middleware(pattern, {}))

    expect(auth['~pattern']).toEqual(pattern)
  })

  it('stores hooks', () => {
    const mw = asRuntime(
      monocon.middleware('*', {
        onRequest,
        beforeHandle,
        afterHandle,
        onResponse,
      }),
    )

    expect(mw['~hooks'].onRequest).toBe(onRequest)
    expect(mw['~hooks'].beforeHandle).toBe(beforeHandle)
    expect(mw['~hooks'].afterHandle).toBe(afterHandle)
    expect(mw['~hooks'].onResponse).toBe(onResponse)
  })
})
