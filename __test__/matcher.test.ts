import { createMatcher } from '../packages/core/src/matcher.ts'
import type { RuntimeRoute } from '../packages/core/src/route.ts'
import type { RouteMethod } from '../packages/core/src/types/http.ts'

function route(method: RouteMethod, path: string): RuntimeRoute {
  return { '~method': method, '~path': path } as RuntimeRoute
}

describe('matcher', () => {
  it('matches static paths', () => {
    const matcher = createMatcher([route('GET', '/health')])

    expect(matcher.match('GET', '/health')?.['~path']).toBe('/health')
    expect(matcher.match('GET', '/other')).toBeUndefined()
  })

  it('matches named params and exposes them through execute-compatible path', () => {
    const matcher = createMatcher([route('GET', '/users/:id')])

    expect(matcher.match('GET', '/users/42')?.['~path']).toBe('/users/:id')
    expect(matcher.match('GET', '/users')).toBeUndefined()
  })

  it('matches wildcard paths', () => {
    const matcher = createMatcher([route('GET', '/admin/*')])

    expect(matcher.match('GET', '/admin/users')?.['~path']).toBe('/admin/*')
    expect(matcher.match('GET', '/admin/a/b')?.['~path']).toBe('/admin/*')
  })

  it('treats a bare * as matching the whole tree', () => {
    const matcher = createMatcher([route('ALL', '*')])

    expect(matcher.match('GET', '/anything')?.['~path']).toBe('*')
    expect(matcher.match('POST', '/deep/path')?.['~path']).toBe('*')
  })

  it('prefers an exact method over ALL', () => {
    const exact = route('GET', '/users')
    const fallback = route('ALL', '/users')
    const matcher = createMatcher([fallback, exact])

    expect(matcher.match('GET', '/users')).toBe(exact)
    expect(matcher.match('POST', '/users')).toBe(fallback)
  })

  it('prefers static segments over dynamic ones', () => {
    const dynamic = route('GET', '/users/:id')
    const staticRoute = route('GET', '/users/me')
    const matcher = createMatcher([dynamic, staticRoute])

    expect(matcher.match('GET', '/users/me')).toBe(staticRoute)
    expect(matcher.match('GET', '/users/42')).toBe(dynamic)
  })

  it('does not match a method that is not registered', () => {
    const matcher = createMatcher([route('GET', '/health')])

    expect(matcher.match('POST', '/health')).toBeUndefined()
  })
})
