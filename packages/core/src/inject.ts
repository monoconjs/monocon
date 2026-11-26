import type { InjectRegistry } from './types/inject.ts'

export function inject<const Registry extends InjectRegistry>(registry: Registry): Registry {
  return registry
}
