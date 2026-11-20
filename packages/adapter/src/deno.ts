import type { Adapter } from './contracts.ts'
import { createStart } from './shared/start.ts'

export type { Adapter, RunningServer, ServerConfig } from './contracts.ts'
export type { Start, StartOptions } from './shared/start.ts'

const denoAdapter: Adapter = {
  listen() {
    throw new Error('The Deno adapter is not implemented yet')
  },
}

export const start = createStart(denoAdapter)
export { denoAdapter }
