import type { StandardSchema, StandardSchemaIssue } from './types/schema.ts'

export type ValidationLocation = 'params' | 'query' | 'body' | 'headers'

export class ValidationError extends Error {
  readonly location: ValidationLocation
  readonly issues: readonly StandardSchemaIssue[]

  constructor(location: ValidationLocation, issues: readonly StandardSchemaIssue[]) {
    super(`Validation failed for ${location}`)
    this.name = 'ValidationError'
    this.location = location
    this.issues = issues
  }
}

export async function validate(
  location: ValidationLocation,
  schema: object | undefined,
  value: unknown,
): Promise<unknown> {
  if (!schema) return value

  const standard = extractStandard(schema)
  if (!standard) return value

  const result = await standard.validate(value)
  if ('issues' in result) throw new ValidationError(location, result.issues)
  return result.value
}

function extractStandard(schema: object): StandardSchema['~standard'] | undefined {
  return (schema as { '~standard'?: StandardSchema['~standard'] })['~standard']
}
