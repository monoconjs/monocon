import type { ProvideHooks } from './types/provide.ts'
import type { SchemaOptions } from './types/schema.ts'

export function provide<
  const Options extends SchemaOptions,
  Hooks extends ProvideHooks<Options>,
  Args extends any[],
>(factory: (...args: Args) => Hooks & { readonly schema?: Options }): (...args: Args) => Hooks

export function provide<const Options extends SchemaOptions, Hooks extends ProvideHooks<Options>>(
  hooks: Hooks & { readonly schema?: Options },
): Hooks

export function provide(value: any): any {
  return value
}
