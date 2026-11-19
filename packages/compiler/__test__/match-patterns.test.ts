import { describe, expect, it } from 'vitest'

import type { MiddlewareDecl, Pattern } from '../src/analyze.ts'
import { matchMiddlewares, patternMatches } from '../src/match.ts'

const middleware = (pattern: Pattern): MiddlewareDecl => ({
  kind: 'middleware',
  file: 'middleware.ts',
  exportName: 'mw',
  pattern,
})

describe('pattern matching', () => {
  it('treats * as matching the whole path tree', () => {
    const all: Pattern = { kind: 'glob', value: '*' }

    expect(patternMatches(all, '/')).toBe(true)
    expect(patternMatches(all, '/users/:id')).toBe(true)
    expect(patternMatches(all, '/a/b/c')).toBe(true)
  })

  it('matches a single-segment wildcard', () => {
    const pattern: Pattern = { kind: 'glob', value: '/admin/*' }

    expect(patternMatches(pattern, '/admin')).toBe(false)
    expect(patternMatches(pattern, '/admin/users')).toBe(true)
    expect(patternMatches(pattern, '/admin/a/b')).toBe(true)
  })

  it('applies include and exclude rules', () => {
    const pattern: Pattern = {
      kind: 'rules',
      include: ['/admin/*'],
      exclude: ['/admin/public/*'],
    }

    expect(patternMatches(pattern, '/admin/users')).toBe(true)
    expect(patternMatches(pattern, '/admin/public/list')).toBe(false)
    expect(patternMatches(pattern, '/users')).toBe(false)
  })

  it('filters and preserves middleware order', () => {
    const logger = middleware({ kind: 'glob', value: '*' })
    const auth = middleware({ kind: 'rules', include: ['/admin/*'], exclude: [] })
    const matched = matchMiddlewares([logger, auth], '/admin/users')

    expect(matched).toEqual([logger, auth])
    expect(matchMiddlewares([logger, auth], '/health')).toEqual([logger])
  })

  it('matches a method prefix exactly', () => {
    const get: Pattern = { kind: 'glob', value: 'GET /users/*' }

    expect(patternMatches(get, '/users/1', 'GET')).toBe(true)
    expect(patternMatches(get, '/users/1', 'POST')).toBe(false)
    expect(patternMatches({ kind: 'glob', value: '/users/*' }, '/users/1', 'POST')).toBe(true)
    expect(patternMatches({ kind: 'glob', value: 'ALL /users/*' }, '/users/1', 'POST')).toBe(true)
  })

  it('treats an ALL route as matching a method-prefixed pattern', () => {
    const get: Pattern = { kind: 'glob', value: 'GET /users/*' }

    expect(patternMatches(get, '/users/1', 'ALL')).toBe(true)
  })

  it('supports method prefixes inside include and exclude rules', () => {
    const pattern: Pattern = {
      kind: 'rules',
      include: ['GET /admin/*'],
      exclude: ['GET /admin/public/*'],
    }

    expect(patternMatches(pattern, '/admin/users', 'GET')).toBe(true)
    expect(patternMatches(pattern, '/admin/users', 'POST')).toBe(false)
    expect(patternMatches(pattern, '/admin/public/x', 'GET')).toBe(false)
  })

  it('filters middlewares by method', () => {
    const any = middleware({ kind: 'glob', value: '*' })
    const getOnly = middleware({ kind: 'glob', value: 'GET /admin/*' })

    expect(matchMiddlewares([any, getOnly], '/admin/users', 'GET')).toEqual([any, getOnly])
    expect(matchMiddlewares([any, getOnly], '/admin/users', 'POST')).toEqual([any])
  })
})
