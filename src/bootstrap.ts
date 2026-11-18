import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  collectDeclarations,
  createFetchHandler,
  createMatcher,
  type RunningServer,
  type ServerConfig,
} from '@monocon/core'

import { nodeAdapter } from './adapters/node.ts'

export { collectDeclarations, createFetchHandler } from '@monocon/core'
export type { CollectedDeclarations } from '@monocon/core'
export type { Adapter, FetchHandler, RunningServer, ServerConfig } from '@monocon/core'

export interface BootstrapOptions extends ServerConfig {
  readonly cwd?: string
  readonly configFile?: string
}

interface BootstrapInput extends BootstrapOptions {
  readonly registry?: object
}

interface LoadedConfig {
  readonly config: ServerConfig
  readonly path: string | undefined
}

const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

export async function bootstrap(options: BootstrapOptions = {}): Promise<RunningServer> {
  const opts: BootstrapInput = options
  const cwd = opts.cwd ?? process.cwd()
  const configFile = opts.configFile ?? 'configuration.ts'

  const loaded = await loadRuntimeConfig(configCandidates(cwd, configFile))
  const registry = opts.registry ?? (await importRegistry(resolve(cwd, '.monocon/registry.mjs')))

  const config: ServerConfig = {
    port: opts.port ?? loaded.config.port ?? 3000,
    hostname: opts.hostname ?? loaded.config.hostname,
  }

  const { routes, middlewares } = collectDeclarations(registry)
  const handler = createFetchHandler(createMatcher(routes), middlewares)

  const server = await nodeAdapter.listen(config, handler)
  if (loaded.path) console.log(`Loaded config: ${loaded.path}`)
  return server
}

function configCandidates(cwd: string, configFile: string): string[] {
  const matched = CONFIG_EXTENSIONS.find((extension) => configFile.endsWith(extension))
  const stem = matched ? configFile.slice(0, -matched.length) : configFile
  const names = [
    configFile,
    ...CONFIG_EXTENSIONS.filter((extension) => extension !== matched).map(
      (extension) => `${stem}${extension}`,
    ),
  ]

  return [cwd, resolve(cwd, 'src')].flatMap((dir) => names.map((name) => resolve(dir, name)))
}

async function loadRuntimeConfig(paths: string[]): Promise<LoadedConfig> {
  const candidates = await Promise.all(
    paths.map(async (path) => ({
      path,
      exists: await access(path).then(
        () => true,
        () => false,
      ),
    })),
  )
  const found = candidates.find((candidate) => candidate.exists)
  if (!found) return { config: {}, path: undefined }

  const module = await import(pathToFileURL(found.path).href)
  const value = module.default ?? module
  return { config: isServerConfig(value) ? value : {}, path: found.path }
}

async function importRegistry(path: string): Promise<object> {
  return import(pathToFileURL(path).href).catch(() => {
    throw new Error(`Registry not found at ${path}. Run 'monocon gen' first.`)
  })
}

function isServerConfig(value: unknown): value is ServerConfig {
  return typeof value === 'object' && value !== null
}
