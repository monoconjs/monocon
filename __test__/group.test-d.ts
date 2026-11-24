import { defineGroup } from '../src/index.ts'

describe('defineGroup types', () => {
  it('joins prefix and path into a literal route path', () => {
    const users = defineGroup('/api')
    const list = users.get('/users').handle(() => [])

    expectTypeOf(list['~path']).toEqualTypeOf<'/api/users'>()
    expectTypeOf(list['~method']).toEqualTypeOf<'GET'>()
  })

  it('carries prefix params and merged meta into the route context', () => {
    const users = defineGroup('/:tenantId/users', { meta: { scope: 'group' } }, { version: 1 })

    users.get('/:id', { action: 'list' }).handle((ctx) => {
      expectTypeOf(ctx.params.tenantId).toEqualTypeOf<string>()
      expectTypeOf(ctx.params.id).toEqualTypeOf<string>()
      expectTypeOf(ctx.meta.scope).toEqualTypeOf<'group'>()
      expectTypeOf(ctx.meta.version).toEqualTypeOf<1>()
      expectTypeOf(ctx.meta.action).toEqualTypeOf<string>()
      return {}
    })
  })

  it('supports nested groups', () => {
    const v1 = defineGroup('/api').group('/v1')
    const health = v1.get('/health').handle(() => 'ok')

    expectTypeOf(health['~path']).toEqualTypeOf<'/api/v1/health'>()
  })
})
