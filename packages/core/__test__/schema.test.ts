import type { StandardSchemaV1 } from '@standard-schema/spec'

import { SchemaValidationError, mergeSchemaOptions, validateSchema } from '../src/schema.ts'
import type { Schema } from '../src/types/schema.ts'

function createSchema<Output>(
  validate: StandardSchemaV1.Props<unknown, Output>['validate'],
): StandardSchemaV1<unknown, Output> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      types: undefined,
      validate,
    },
  }
}

describe('schema validation', () => {
  it('returns the validated value from a standard schema', async () => {
    const schema = createSchema<string>((value) => ({ value: `id:${String(value)}` }))

    await expect(validateSchema(schema, '1')).resolves.toBe('id:1')
  })

  it('awaits asynchronous validation', async () => {
    const schema = createSchema<number>(async (value) => ({ value: Number(value) }))

    await expect(validateSchema(schema, '2')).resolves.toBe(2)
  })

  it('throws validation issues', async () => {
    const schema = createSchema<never>(() => ({
      issues: [{ message: 'invalid', path: ['body'] }],
    }))

    await expect(validateSchema(schema, undefined)).rejects.toMatchObject({
      name: 'SchemaValidationError',
      issues: [{ message: 'invalid' }],
    })
  })

  it('rejects invalid standard schemas', async () => {
    const invalid = {
      '~standard': { version: 2, vendor: 'test', validate: () => ({ value: 1 }) },
    } as unknown as Schema

    await expect(validateSchema(invalid, 1)).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('rejects malformed validation results', async () => {
    const invalid = {
      '~standard': { version: 1, vendor: 'test', validate: () => ({}) },
    } as unknown as Schema

    await expect(validateSchema(invalid, 1)).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('keeps callable standard schemas when merging options', () => {
    const schema = Object.assign(() => undefined, {
      '~standard': {
        version: 1,
        vendor: 'test',
        types: undefined,
        validate: () => ({ value: 'ok' }),
      },
    }) as unknown as Schema

    const merged = mergeSchemaOptions([{ query: schema }], {})

    expect(merged.query).toBe(schema)
  })

  it('ignores parse-only schemas when merging options', () => {
    const schema = { parse: () => 'ok' } as unknown as Schema

    const merged = mergeSchemaOptions([{ query: schema }], {})

    expect(merged.query).toBeUndefined()
  })
})
