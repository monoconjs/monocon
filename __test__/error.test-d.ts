import type { ErrorCode, ErrorContextOf, PayloadOf, StatusOf } from '../src/index.ts'
import type { StandardSchemaIssue } from '../src/types/schema.ts'

declare module '../src/global.ts' {
  interface ErrorMap {
    CONFLICT_ERROR: { reason: string; retryAfter: number }
  }
  interface ErrorStatusMap {
    CONFLICT_ERROR: 409
  }
}

describe('error types', () => {
  it('name is a literal union from the error map', () => {
    expectTypeOf<ErrorCode>().toEqualTypeOf<
      | 'VALIDATION_ERROR'
      | 'PARSE_ERROR'
      | 'NOT_FOUND_ERROR'
      | 'NO_HANDLER_ERROR'
      | 'INTERNAL_ERROR'
      | 'CONFLICT_ERROR'
    >()
  })

  it('payload is derived from the factory parameter', () => {
    expectTypeOf<PayloadOf<'VALIDATION_ERROR'>>().toEqualTypeOf<readonly StandardSchemaIssue[]>()
    expectTypeOf<PayloadOf<'CONFLICT_ERROR'>>().toEqualTypeOf<{
      reason: string
      retryAfter: number
    }>()
  })

  it('status is derived from the factory', () => {
    expectTypeOf<StatusOf<'CONFLICT_ERROR'>>().toEqualTypeOf<409>()
  })

  it('error context narrows error and status by name', () => {
    const ctx = null as unknown as ErrorContextOf<'CONFLICT_ERROR'>
    expectTypeOf(ctx.name).toEqualTypeOf<'CONFLICT_ERROR'>()
    expectTypeOf(ctx.payload).toEqualTypeOf<{ reason: string; retryAfter: number }>()
    expectTypeOf(ctx.status).toEqualTypeOf<409>()
  })

  it('deps narrow the handler context to selected names', () => {
    const ctx = null as unknown as ErrorContextOf<'VALIDATION_ERROR' | 'CONFLICT_ERROR'>
    expectTypeOf(ctx.name).toEqualTypeOf<'VALIDATION_ERROR' | 'CONFLICT_ERROR'>()
  })

  it('carries context stage', () => {
    expectTypeOf<ErrorContextOf<ErrorCode>['stage']>().toEqualTypeOf<
      'validation' | 'onRequest' | 'beforeHandle' | 'handle' | 'afterHandle' | 'onResponse'
    >()
  })
})
