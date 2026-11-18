import { resolve } from 'node:path'

import { collectDeclarations, createFetchHandler, createMatcher } from '@monocon/core'

import type { Adapter, RunningServer, ServerConfig } from '../contracts.ts'
import { importRegistry, loadRuntimeConfig } from './config.ts'

export interface StartOptions extends ServerConfig {
  readonly registry?: object
  readonly cwd?: string
  readonly configFile?: string
}

export type Start = (options?: StartOptions) => Promise<RunningServer>

export function createStart(adapter: Adapter): Start {
  return async function start(options: StartOptions = {}): Promise<RunningServer> {
    const cwd = options.cwd ?? process.cwd()
    const configFile = options.configFile ?? 'configuration.ts'

    const loaded = await loadRuntimeConfig(cwd, configFile)
    const registry =
      options.registry ?? (await importRegistry(resolve(cwd, '.monocon/registry.mjs')))

    const config: ServerConfig = {
      port: options.port ?? loaded.config.port ?? 3000,
      hostname: options.hostname ?? loaded.config.hostname,
    }

    const { routes, middlewares } = collectDeclarations(registry)
    const handler = createFetchHandler(createMatcher(routes), middlewares)

    const server = await adapter.listen(config, handler)
    if (loaded.path) console.log(`Loaded config: ${loaded.path}`)
    return server
  }
}
