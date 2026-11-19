import type { StandardSchemaIssue } from './types/schema.ts'

export interface RouteMiddlewareContext {}

export interface RouteRecords {}

// ErrorMap maps name -> error type (generated entries use `(typeof X)['~payload']`).
export interface ErrorMap {
  VALIDATION_ERROR: readonly StandardSchemaIssue[]
  PARSE_ERROR: unknown
  NOT_FOUND_ERROR: unknown
  NO_HANDLER_ERROR: unknown
  INTERNAL_ERROR: unknown
}

// ErrorStatusMap maps code -> status literal (generated entries use `(typeof X)['~status']`).
export interface ErrorStatusMap {
  VALIDATION_ERROR: 400
  PARSE_ERROR: 400
  NOT_FOUND_ERROR: 404
  NO_HANDLER_ERROR: 500
  INTERNAL_ERROR: 500
}
