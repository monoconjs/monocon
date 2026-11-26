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

  const candidate: unknown = schema

  try {
    if (hasStandard(candidate)) {
      const result = await candidate['~standard'].validate(value)
      if (hasIssues(result)) throw new SchemaValidationError(result.issues)
      if (hasValue(result)) return result.value
      return value
    }

    if (hasParse(candidate)) return candidate.parse(value)
    return value
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
      if (value !== undefined && isSchema(value)) merged[key] = value
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
    readonly validate: (value: unknown) => unknown
  }
}

function isSchema(value: unknown): value is Schema {
  return isRecord(value)
}

function hasStandard(value: unknown): value is StandardSchemaLike {
  return isRecord(value) && isRecord(value['~standard'])
}

function hasParse(value: unknown): value is { parse: (value: unknown) => unknown } {
  return isRecord(value) && typeof value.parse === 'function'
}

function hasIssues(value: unknown): value is { issues: readonly unknown[] } {
  return isRecord(value) && Array.isArray(value.issues)
}

function hasValue(value: unknown): value is { value: unknown } {
  return isRecord(value) && 'value' in value
}
