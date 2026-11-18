// oxlint-disable no-shadow
// oxlint-disable typescript/no-unsafe-type-assertion
import type { ErrorFactory, ErrorOptions } from '../types/error.ts'
import type { InferOutput, Schema } from '../types/schema.ts'

export type ErrorHook = (ctx: any) => Promise<Response | void> | Response | void

export interface RuntimeErrorInstance extends Error {
  readonly name: string
  readonly status: number
  readonly error: unknown
  readonly '~toResponse'?: (payload: any) => Response
}

export interface RuntimeErrorFactory {
  (payload: unknown): RuntimeErrorInstance
  new (payload: unknown): RuntimeErrorInstance
  readonly '~factory': true
  readonly '~payload': unknown
  readonly '~status': number
  '~name': string | undefined
  readonly '~toResponse'?: (payload: any) => Response
}

interface FactoryConfig<Payload, Status extends number> {
  readonly status: Status
  readonly toResponse?: (payload: Payload) => Response
}

function buildFactory<Payload, Status extends number>(
  config: FactoryConfig<Payload, Status>,
  initialName: string | undefined,
  errorSchema: unknown,
): RuntimeErrorFactory {
  const factory = Object.assign(
    function (payload: unknown): RuntimeErrorInstance {
      const name = factory['~name'] ?? 'INTERNAL_ERROR'
      return Object.assign(new Error(name), {
        name,
        status: config.status,
        error: payload,
        ['~toResponse']: config.toResponse,
      })
    },
    {
      ['~factory']: true as const,
      ['~payload']: errorSchema,
      ['~status']: config.status,
      ['~name']: initialName,
      ['~toResponse']: config.toResponse,
    },
  ) as unknown as RuntimeErrorFactory
  return factory
}

/** Define an error factory that tags errors with a name, status, and schema-validated payload. */
export function defineError<ErrorSchema extends Schema, Status extends number>(
  options: ErrorOptions<ErrorSchema, Status>,
): ErrorFactory<InferOutput<ErrorSchema>, Status> {
  const factory = buildFactory(options, options.name, options.payload)
  return factory as unknown as ErrorFactory<InferOutput<ErrorSchema>, Status>
}

/** Define a builtin error with a fixed name and a framework-provided toResponse. */
export function defineBuiltin<Payload, Status extends number>(
  name: string,
  config: FactoryConfig<Payload, Status>,
): ErrorFactory<Payload, Status> {
  const factory = buildFactory(config, name, undefined)
  return factory as unknown as ErrorFactory<Payload, Status>
}

export function createError(name: string, status: number, error: unknown): RuntimeErrorInstance {
  return Object.assign(new Error(`MonoconError: ${name}`), { name, status, error })
}

export function isErrorFactory(value: unknown): value is RuntimeErrorFactory {
  return typeof value === 'function' && '~factory' in value && value['~factory'] === true
}

export function assignErrorName(factory: RuntimeErrorFactory, name: string): void {
  // An explicit `name` passed to defineError() takes precedence over the registry export name.
  if (factory['~name'] === undefined) factory['~name'] = name
}
