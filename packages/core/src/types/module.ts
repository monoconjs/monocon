import type { ModuleMeta } from './meta.ts'
import type { RouteDefinition } from './route.ts'

export interface ModuleDefinition<Meta extends ModuleMeta = ModuleMeta, Injects = {}> {
  META: Meta
  INJECTS: Injects
  routes: RouteDefinition[]
}
