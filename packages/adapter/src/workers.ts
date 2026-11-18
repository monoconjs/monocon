import type { Adapter } from './contracts.ts'
import { createStart } from './shared/start.ts'

export type { Adapter, RunningServer, ServerConfig } from './contracts.ts'

const workersAdapter: Adapter = {
  listen() {
    throw new Error('The Cloudflare Workers adapter is not implemented yet')
  },
}

export const start = createStart(workersAdapter)
export { workersAdapter }
