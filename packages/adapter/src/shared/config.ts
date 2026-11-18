import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ServerConfig } from '../contracts.ts'

export interface LoadedConfig {
  readonly config: ServerConfig
  readonly path: string | undefined
}

const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

export async function loadRuntimeConfig(cwd: string, configFile: string): Promise<LoadedConfig> {
  return loadConfigAt(configCandidates(cwd, configFile))
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

async function loadConfigAt(paths: string[]): Promise<LoadedConfig> {
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

export async function importRegistry(path: string): Promise<object> {
  return import(pathToFileURL(path).href).catch(() => {
    throw new Error(`Registry not found at ${path}. Run 'monocon gen' first.`)
  })
}

function isServerConfig(value: unknown): value is ServerConfig {
  return typeof value === 'object' && value !== null
}
