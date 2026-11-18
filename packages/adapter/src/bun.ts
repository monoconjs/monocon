import type { Adapter } from './contracts.ts'
import { createStart } from './shared/start.ts'

export type { Adapter, RunningServer, ServerConfig } from './contracts.ts'

const bunAdapter: Adapter = {
  listen() {
    throw new Error('The Bun adapter is not implemented yet')
  },
}

export const start = createStart(bunAdapter)
export { bunAdapter }
