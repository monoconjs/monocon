import type { RuntimeRoute } from '../packages/core/src/route.ts'
import * as monocon from '../src/index.ts'

const onRequestA = () => ({ a: 1 })
const onRequestB = () => ({ b: 2 })
const beforeHandle = () => ({ c: 3 })
const handler = () => 'ok'
const afterHandle = () => undefined
const onResponse = () => undefined

function isRuntimeRoute(value: object): value is RuntimeRoute {
  return '~method' in value && '~path' in value && '~hooks' in value
}

function asRuntime(value: object): RuntimeRoute {
  if (!isRuntimeRoute(value)) {
    throw new TypeError('Expected a runtime route')
  }
  return value
}

describe('route factory', () => {
  it('creates routes for every HTTP method', () => {
    expect(asRuntime(monocon.get('/x'))['~method']).toBe('GET')
    expect(asRuntime(monocon.post('/x'))['~method']).toBe('POST')
    expect(asRuntime(monocon.put('/x'))['~method']).toBe('PUT')
    expect(asRuntime(monocon.patch('/x'))['~method']).toBe('PATCH')
    expect(asRuntime(monocon.del('/x'))['~method']).toBe('DELETE')
    expect(asRuntime(monocon.delete('/x'))['~method']).toBe('DELETE')
    expect(asRuntime(monocon.head('/x'))['~method']).toBe('HEAD')
    expect(asRuntime(monocon.options('/x'))['~method']).toBe('OPTIONS')
    expect(asRuntime(monocon.all('/x'))['~method']).toBe('ALL')
  })

  it('stores path and meta, defaulting options to empty', () => {
    const withOptions = asRuntime(monocon.get('/users/:id', { auth: true }))

    expect(withOptions['~path']).toBe('/users/:id')
    expect(withOptions['~options']).toEqual({ meta: { auth: true } })

    const withoutOptions = asRuntime(monocon.get('/health'))

    expect(withoutOptions['~options']).toEqual({})
  })

  it('starts with no handler and empty hooks', () => {
    const route = asRuntime(monocon.get('/fresh'))

    expect(route['~handler']).toBeUndefined()
    expect(route['~hooks']).toEqual({
      onRequest: [],
      beforeHandle: [],
      afterHandle: [],
      onResponse: [],
      onError: [],
    })
  })
})

describe('route builder', () => {
  it('stores hooks in lifecycle order', () => {
    const route = asRuntime(
      monocon
        .get('/chain')
        .onRequest(onRequestA)
        .onRequest(onRequestB)
        .beforeHandle(beforeHandle)
        .handle(handler)
        .afterHandle(afterHandle)
        .onResponse(onResponse),
    )

    expect(route['~hooks'].onRequest).toEqual([onRequestA, onRequestB])
    expect(route['~hooks'].beforeHandle).toEqual([beforeHandle])
    expect(route['~hooks'].afterHandle).toEqual([afterHandle])
    expect(route['~hooks'].onResponse).toEqual([onResponse])
    expect(route['~handler']).toBe(handler)
  })

  it('returns the same builder across every stage', () => {
    const base = monocon.get('/chain')
    const afterHook = base.onRequest(() => ({}))
    const afterBeforeHandle = afterHook.beforeHandle(() => ({}))
    const routeAfterHandle = afterBeforeHandle.handle(() => 'ok')
    const afterAfterHook = routeAfterHandle.afterHandle(() => undefined)
    const final = afterAfterHook.onResponse(() => undefined)

    expect(asRuntime(afterHook)).toBe(asRuntime(base))
    expect(asRuntime(afterBeforeHandle)).toBe(asRuntime(base))
    expect(asRuntime(routeAfterHandle)).toBe(asRuntime(base))
    expect(asRuntime(afterAfterHook)).toBe(asRuntime(base))
    expect(asRuntime(final)).toBe(asRuntime(base))
  })

  it('allows skipping stages', () => {
    const route = asRuntime(monocon.get('/direct').handle(() => 'ok'))

    expect(route['~hooks'].onRequest).toEqual([])
    expect(route['~hooks'].beforeHandle).toEqual([])
    expect(route['~hooks'].afterHandle).toEqual([])
    expect(route['~hooks'].onResponse).toEqual([])
    expect(route['~handler']).toBeTypeOf('function')
  })
})
