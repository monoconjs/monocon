import type { StandardSchemaIssue } from '../types/schema.ts'
import type { ValidationLocation } from '../validation.ts'
import { defineBuiltin } from './factory.ts'

export interface ValidationPayload {
  readonly location: ValidationLocation
  readonly issues: readonly StandardSchemaIssue[]
}

export const ValidationError = defineBuiltin<ValidationPayload, 400>('VALIDATION_ERROR', {
  status: 400,
  toResponse: ({ location, issues }) =>
    Response.json({ name: 'VALIDATION_ERROR', location, error: issues }, { status: 400 }),
})

export const ParseError = defineBuiltin<{ message: string }, 400>('PARSE_ERROR', {
  status: 400,
  toResponse: (payload) => Response.json({ name: 'PARSE_ERROR', ...payload }, { status: 400 }),
})

export const NoHandlerError = defineBuiltin<{ method: string; path: string }, 500>(
  'NO_HANDLER_ERROR',
  {
    status: 500,
    toResponse: (payload) =>
      Response.json({ name: 'NO_HANDLER_ERROR', ...payload }, { status: 500 }),
  },
)
