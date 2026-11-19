import type { MiddlewareFor } from '../packages/core/src/types/middleware.ts'
import { del, get } from '../src/index.ts'

declare module '../packages/core/src/global.ts' {
  interface RouteMiddlewareContext {
    'GET /mw-method/:id': { readScope: 'read' }
    'DELETE /mw-method/:id': { deleteScope: 'delete' }
  }
}

describe('method-aware middleware context', () => {
  it('selects provided fields by method and path', () => {
    expectTypeOf<MiddlewareFor<'GET', '/mw-method/:id'>>().toEqualTypeOf<{ readScope: 'read' }>()
    expectTypeOf<MiddlewareFor<'DELETE', '/mw-method/:id'>>().toEqualTypeOf<{
      deleteScope: 'delete'
    }>()
  })

  it('injects method-specific fields into route context', () => {
    get('/mw-method/:id').handle((ctx) => {
      expectTypeOf(ctx.readScope).toEqualTypeOf<'read'>()
      return {}
    })

    del('/mw-method/:id').handle((ctx) => {
      expectTypeOf(ctx.deleteScope).toEqualTypeOf<'delete'>()
      return {}
    })
  })
})
