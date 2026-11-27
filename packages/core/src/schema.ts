import type { Schema, SchemaOptions } from './types/schema.ts'

const SCHEMA_KEYS = ['params', 'query', 'body', 'headers', 'response'] as const

export class SchemaValidationError extends Error {
  readonly issues: readonly unknown[]

  constructor(issues: readonly unknown[]) {
    super('Schema validation failed')
    this.name = 'SchemaValidationError'
    this.issues = issues
  }
}

export async function validateSchema(schema: Schema | undefined, value: unknown): Promise<unknown> {
  if (schema === undefined) return value

  const standard = schema['~standard']
  if (standard.version !== 1 || typeof standard.validate !== 'function') {
    throw new SchemaValidationError([{ message: 'Invalid standard schema' }])
  }

  try {
    const result = await standard.validate(value)
    if (hasIssues(result)) throw new SchemaValidationError(result.issues)
    if (hasValue(result)) return result.value
    throw new SchemaValidationError([{ message: 'Invalid standard schema result' }])
  } catch (error) {
    if (error instanceof SchemaValidationError) throw error
    throw new SchemaValidationError([error])
  }
}

export function mergeSchemaOptions(
  sources: readonly SchemaOptions[],
  routeOptions: Record<string, unknown>,
): SchemaOptions {
  const merged: SchemaOptions = {}
  for (const source of [...sources, routeOptions]) {
    for (const key of SCHEMA_KEYS) {
      const value: unknown = source[key]
      if (value !== undefined && isSchemaLike(value)) merged[key] = value as Schema
    }
  }
  return merged
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

interface StandardSchemaLike {
  readonly '~standard': {
    readonly version: unknown
    readonly validate: unknown
  }
}

function isSchemaLike(value: unknown): value is StandardSchemaLike {
  const indexable =
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && !Array.isArray(value))
  return indexable && isRecord((value as { '~standard'?: unknown })['~standard'])
}

function hasIssues(value: unknown): value is { issues: readonly unknown[] } {
  return isRecord(value) && Array.isArray(value.issues)
}

function hasValue(value: unknown): value is { value: unknown } {
  return isRecord(value) && 'value' in value
}
