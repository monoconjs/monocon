import { describe, expect, it } from 'vitest'

import { middleware } from '../src/middleware.ts'
import { globToRegExp, matchMiddlewares, patternMatches } from '../src/pattern.ts'

describe('pattern matching', () => {
  it('treats * as matching the whole path tree', () => {
    expect(patternMatches('*', '/')).toBe(true)
    expect(patternMatches('*', '/users/:id')).toBe(true)
    expect(patternMatches('*', '/a/b/c')).toBe(true)
  })

  it('matches a single-segment wildcard', () => {
    expect(patternMatches('/admin/*', '/admin')).toBe(false)
    expect(patternMatches('/admin/*', '/admin/users')).toBe(true)
    expect(patternMatches('/admin/*', '/admin/a/b')).toBe(true)
  })

  it('applies include and exclude rules', () => {
    const pattern = { include: ['/admin/*'], exclude: ['/admin/public/*'] }

    expect(patternMatches(pattern, '/admin/users')).toBe(true)
    expect(patternMatches(pattern, '/admin/public/list')).toBe(false)
    expect(patternMatches(pattern, '/users')).toBe(false)
  })

  it('filters and preserves middleware order', () => {
    const logger = middleware('*', {})
    const auth = middleware({ include: ['/admin/*'], exclude: [] }, {})

    expect(matchMiddlewares([logger, auth], '/admin/users')).toEqual([logger, auth])
    expect(matchMiddlewares([logger, auth], '/health')).toEqual([logger])
  })
})

describe('globToRegExp', () => {
  it('caches the compiled expression by glob', () => {
    expect(globToRegExp('/admin/*')).toBe(globToRegExp('/admin/*'))
  })
})
