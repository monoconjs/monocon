import { describe, expect, it } from 'vitest'

import { defineMiddleware } from '../packages/core/src/middleware.ts'
import { globToRegExp, matchMiddlewares, patternMatches } from '../packages/core/src/pattern.ts'

describe('pattern matching', () => {
  it('treats * as matching the whole path tree', () => {
    expect(patternMatches('*', '/')).toBe(true)
    expect(patternMatches('*', '/users/:id')).toBe(true)
    expect(patternMatches('*', '/a/b/c')).toBe(true)
  })

  it('treats a missing pattern as global', () => {
    const global = defineMiddleware({})

    expect(patternMatches(undefined, '/users/1', 'GET')).toBe(true)
    expect(matchMiddlewares([global], '/users/1', 'GET')).toEqual([global])
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
    const logger = defineMiddleware({}, '*')
    const auth = defineMiddleware({}, { include: ['/admin/*'], exclude: [] })

    expect(matchMiddlewares([logger, auth], '/admin/users')).toEqual([logger, auth])
    expect(matchMiddlewares([logger, auth], '/health')).toEqual([logger])
  })

  it('matches a method prefix exactly', () => {
    expect(patternMatches('GET /users/*', '/users/1', 'GET')).toBe(true)
    expect(patternMatches('GET /users/*', '/users/1', 'POST')).toBe(false)
    expect(patternMatches('/users/*', '/users/1', 'POST')).toBe(true)
    expect(patternMatches('ALL /users/*', '/users/1', 'POST')).toBe(true)
  })

  it('treats an ALL route as matching a method-prefixed pattern', () => {
    expect(patternMatches('GET /users/*', '/users/1', 'ALL')).toBe(true)
  })

  it('ignores the method constraint when no method is supplied', () => {
    expect(patternMatches('GET /users/*', '/users/1')).toBe(true)
  })

  it('supports method prefixes inside include and exclude rules', () => {
    const pattern = { include: ['GET /admin/*'], exclude: ['GET /admin/public/*'] }

    expect(patternMatches(pattern, '/admin/users', 'GET')).toBe(true)
    expect(patternMatches(pattern, '/admin/users', 'POST')).toBe(false)
    expect(patternMatches(pattern, '/admin/public/x', 'GET')).toBe(false)
  })

  it('filters middlewares by method', () => {
    const any = defineMiddleware({}, '*')
    const getOnly = defineMiddleware({}, 'GET /admin/*')

    expect(matchMiddlewares([any, getOnly], '/admin/users', 'GET')).toEqual([any, getOnly])
    expect(matchMiddlewares([any, getOnly], '/admin/users', 'POST')).toEqual([any])
  })
})

describe('globToRegExp', () => {
  it('caches the compiled expression by glob', () => {
    expect(globToRegExp('/admin/*')).toBe(globToRegExp('/admin/*'))
  })
})
