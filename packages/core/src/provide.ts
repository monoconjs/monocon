import type { ProvideHooks, ProvideLike } from './types/provide.ts'

export function provide<Hooks extends ProvideHooks>(hooks: Hooks): Hooks
export function provide<Factory extends (...args: any[]) => ProvideHooks>(factory: Factory): Factory
export function provide(value: ProvideLike): ProvideLike {
  return value
}
