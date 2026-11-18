import { ValidationError } from './errors/builtin.ts'
import type { StandardSchema } from './types/schema.ts'

export type ValidationLocation = 'params' | 'query' | 'body' | 'headers'

export async function validate(
  location: ValidationLocation,
  schema: object | undefined,
  value: unknown,
): Promise<unknown> {
  if (!schema) return value

  const standard = extractStandard(schema)
  if (!standard) return value

  const result = await standard.validate(value)
  if ('issues' in result) throw ValidationError({ location, issues: result.issues })
  return result.value
}

function extractStandard(schema: object): StandardSchema['~standard'] | undefined {
  return (schema as { '~standard'?: StandardSchema['~standard'] })['~standard']
}
