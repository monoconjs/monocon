import { isMiddleware, isRoute } from '../packages/core/src/fetch-handler.ts'
import type { RuntimeRoute } from '../packages/core/src/route.ts'
import * as monocon from '../src/index.ts'

function asRuntime(value: object): RuntimeRoute {
  if (
    !('~method' in value) ||
    !('~path' in value) ||
    !('~hooks' in value) ||
    !('~handler' in value)
  ) {
    throw new TypeError('Expected a runtime route')
  }
  return value as RuntimeRoute
}

describe('defineGroup', () => {
  it('prefixes paths for every route method', () => {
    const api = monocon.defineGroup('/api')

    expect(asRuntime(api.get('/'))['~path']).toBe('/api')
    expect(asRuntime(api.post('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.put('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.patch('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.del('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.delete('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.head('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.options('/users'))['~path']).toBe('/api/users')
    expect(asRuntime(api.all('*'))['~path']).toBe('/api/*')
  })

  it('normalizes slashes and supports nested groups', () => {
    const v1 = monocon.defineGroup('/api/').group('v1/')

    expect(asRuntime(v1.get('/users'))['~path']).toBe('/api/v1/users')
    expect(asRuntime(v1.get('/'))['~path']).toBe('/api/v1')
    expect(asRuntime(monocon.defineGroup('').get('/health'))['~path']).toBe('/health')
  })

  it('merges group options and meta with route values taking precedence', () => {
    const api = monocon.defineGroup(
      '/api',
      { meta: { scope: 'group', shared: 'group' } },
      { version: 1 },
    )
    const route = asRuntime(api.get('/users', { shared: 'route', action: 'list' }))

    expect(route['~options'].meta).toEqual({
      scope: 'group',
      shared: 'route',
      version: 1,
      action: 'list',
    })
  })

  it('does not expose route markers on the group itself', () => {
    const api = monocon.defineGroup('/api')

    expect('~path' in api).toBe(false)
    expect(isRoute(api)).toBe(false)
    expect(isMiddleware(api)).toBe(false)
  })
})
