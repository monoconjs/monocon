import * as monocon from '../src/index.ts'
import type { RuntimeEndpoint } from '../src/index.ts'

const onRequestA = () => ({ a: 1 })
const onRequestB = () => ({ b: 2 })
const beforeHandle = () => ({ c: 3 })
const handler = () => 'ok'
const afterHandle = () => undefined
const onResponse = () => undefined

function isRuntimeEndpoint(value: object): value is RuntimeEndpoint {
  return '~method' in value && '~path' in value && '~hooks' in value
}

function asRuntime(value: object): RuntimeEndpoint {
  if (!isRuntimeEndpoint(value)) {
    throw new TypeError('Expected a runtime endpoint')
  }
  return value
}

describe('endpoint factory', () => {
  it('creates endpoints for every HTTP method', () => {
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

  it('stores path and options, defaulting options to empty', () => {
    const withOptions = asRuntime(monocon.get('/users/:id', { meta: { auth: true } }))

    expect(withOptions['~path']).toBe('/users/:id')
    expect(withOptions['~options']).toEqual({ meta: { auth: true } })

    const withoutOptions = asRuntime(monocon.get('/health'))

    expect(withoutOptions['~options']).toEqual({})
  })

  it('starts with no handler and empty hooks', () => {
    const endpoint = asRuntime(monocon.get('/fresh'))

    expect(endpoint['~handler']).toBeUndefined()
    expect(endpoint['~hooks']).toEqual({
      onRequest: [],
      beforeHandle: [],
      afterHandle: [],
      onResponse: [],
    })
  })
})

describe('endpoint builder', () => {
  it('stores hooks in lifecycle order', () => {
    const endpoint = asRuntime(
      monocon
        .get('/chain')
        .onRequest(onRequestA)
        .onRequest(onRequestB)
        .beforeHandle(beforeHandle)
        .handle(handler)
        .afterHandle(afterHandle)
        .onResponse(onResponse),
    )

    expect(endpoint['~hooks'].onRequest).toEqual([onRequestA, onRequestB])
    expect(endpoint['~hooks'].beforeHandle).toEqual([beforeHandle])
    expect(endpoint['~hooks'].afterHandle).toEqual([afterHandle])
    expect(endpoint['~hooks'].onResponse).toEqual([onResponse])
    expect(endpoint['~handler']).toBe(handler)
  })

  it('returns the same builder across every stage', () => {
    const base = monocon.get('/chain')
    const afterHook = base.onRequest(() => ({}))
    const afterBeforeHandle = afterHook.beforeHandle(() => ({}))
    const endpointAfterHandle = afterBeforeHandle.handle(() => 'ok')
    const afterAfterHook = endpointAfterHandle.afterHandle(() => undefined)
    const final = afterAfterHook.onResponse(() => undefined)

    expect(asRuntime(afterHook)).toBe(asRuntime(base))
    expect(asRuntime(afterBeforeHandle)).toBe(asRuntime(base))
    expect(asRuntime(endpointAfterHandle)).toBe(asRuntime(base))
    expect(asRuntime(afterAfterHook)).toBe(asRuntime(base))
    expect(asRuntime(final)).toBe(asRuntime(base))
  })

  it('allows skipping stages', () => {
    const endpoint = asRuntime(monocon.get('/direct').handle(() => 'ok'))

    expect(endpoint['~hooks'].onRequest).toEqual([])
    expect(endpoint['~hooks'].beforeHandle).toEqual([])
    expect(endpoint['~hooks'].afterHandle).toEqual([])
    expect(endpoint['~hooks'].onResponse).toEqual([])
    expect(endpoint['~handler']).toBeTypeOf('function')
  })
})
