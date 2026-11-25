import type { output as ZodOutput, ZodType } from 'zod'

import type { MaybePromise } from './_utils.ts'

export interface StandardSchemaIssue {
  readonly message: string
  readonly path?: readonly unknown[]
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output }
  | { readonly issues: readonly StandardSchemaIssue[] }

export interface StandardSchema<Output = unknown> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => MaybePromise<StandardSchemaResult<Output>>
  }
}

export type Schema = ZodType | StandardSchema

export type InferOutput<SchemaInput> = SchemaInput extends ZodType
  ? ZodOutput<SchemaInput>
  : SchemaInput extends StandardSchema<infer Output>
    ? Output
    : unknown
