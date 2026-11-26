import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { analyzeSources, expandEntries } from './analyze.ts'
import { loadConfig } from './config.ts'
import { generateDeclarations, type GeneratedFile } from './generate.ts'
import { generateRuntime } from './runtime.ts'

export interface BuildResult {
  files: string[]
  moduleCount: number
}

export async function build(configPath?: string): Promise<BuildResult> {
  const config = await loadConfig(configPath)
  const entries = await expandEntries(config.entry, config.rootDir)
  const sources = entries.filter((file) => !isInside(file, config.outDir))
  const analysis = await analyzeSources(sources, config.rootDir)
  const files = [...generateDeclarations(analysis, config), ...generateRuntime(analysis, config)]

  await writeGenerated(files, config.outDir)

  return {
    files: files.map((file) => file.path),
    moduleCount: analysis.modules.length,
  }
}

function isInside(file: string, directory: string): boolean {
  const path = relative(directory, file)
  return !isAbsolute(path) && path !== '..' && !path.startsWith('../')
}

async function writeGenerated(files: GeneratedFile[], outDir: string): Promise<void> {
  const modulesDir = resolve(outDir, 'modules')
  await mkdir(modulesDir, { recursive: true })

  const expected = new Set(
    files.filter((file) => dirname(file.path) === modulesDir).map((file) => basename(file.path)),
  )
  const existing = await readdir(modulesDir)
  await Promise.all(
    existing
      .filter((name) => name.endsWith('.d.ts') && !expected.has(name))
      .map((name) => rm(resolve(modulesDir, name), { force: true })),
  )

  await Promise.all(
    files.map(async (file) => {
      await mkdir(dirname(file.path), { recursive: true })
      const current = await readFile(file.path, 'utf8').catch(() => undefined)
      if (current !== file.content) await writeFile(file.path, file.content)
    }),
  )
}
