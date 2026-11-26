import type { InjectHooks, InjectLike } from './types/inject.ts'

export function defineInject<Hooks extends InjectHooks>(hooks: Hooks): Hooks
export function defineInject<Factory extends (...args: any[]) => InjectHooks>(
  factory: Factory,
): Factory
export function defineInject(value: InjectLike): InjectLike {
  return value
}
