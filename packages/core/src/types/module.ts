import type { Meta } from './meta.ts'
import type { RouteDefinition } from './route.ts'

export interface ModuleDefinition<ModuleMeta extends Meta = Meta, Injects = {}> {
  META: ModuleMeta
  INJECTS: Injects
  routes: RouteDefinition[]
}
