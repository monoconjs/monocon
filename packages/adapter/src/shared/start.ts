import {
  createFetchHandler,
  createMatcher,
  isMiddleware,
  isRoute,
  type RuntimeMiddleware,
  type RuntimeRoute,
} from '@monocon/core'

import type { Adapter, RunningServer, ServerConfig } from '../contracts.ts'

export interface StartOptions extends ServerConfig {
  readonly routes?: object | readonly RuntimeRoute[]
  readonly middlewares?: object | readonly RuntimeMiddleware[]
}

export type Start = (options?: StartOptions) => Promise<RunningServer>

export function createStart(adapter: Adapter): Start {
  return async function start(options: StartOptions = {}): Promise<RunningServer> {
    const routes = Object.values(options.routes ?? {}).filter(isRoute)
    const middlewares = Object.values(options.middlewares ?? {}).filter(isMiddleware)
    const config: ServerConfig = {
      port: options.port ?? 3000,
      hostname: options.hostname,
    }

    return adapter.listen(config, createFetchHandler(createMatcher(routes), middlewares))
  }
}
