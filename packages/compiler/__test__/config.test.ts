import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { defineConfig, loadConfig } from '../src/config.ts'

describe('loadConfig', () => {
  it('reads entries and the output directory from a defineConfig call', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monocon-config-'))
    const configPath = join(root, 'monocon.config.ts')
    await writeFile(
      configPath,
      `import { defineConfig } from '@monocon/compiler'\nexport default defineConfig({ entry: ['src/**/*.ts'], outDir: 'generated' })\n`,
    )

    const config = await loadConfig(configPath)

    expect(config.rootDir).toBe(root)
    expect(config.outDir).toBe(join(root, 'generated'))
    expect(config.entry).toEqual([join(root, 'src/**/*.ts')])
  })

  it('accepts a plain default export and uses the default output directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monocon-config-'))
    const configPath = join(root, 'monocon.config.ts')
    await writeFile(configPath, `export default { entry: ['src/routes/users.ts'] }\n`)

    const config = await loadConfig(configPath)

    expect(config.outDir).toBe(join(root, '.monocon'))
    expect(config.entry).toEqual([join(root, 'src/routes/users.ts')])
  })

  it('rejects a config without a default export', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monocon-config-'))
    const configPath = join(root, 'monocon.config.ts')
    await writeFile(configPath, `export const config = { entry: ['src/**/*.ts'] }\n`)

    await expect(loadConfig(configPath)).rejects.toThrow('No default export found')
  })

  it('returns the config object from defineConfig', () => {
    const config = defineConfig({ entry: ['src/**/*.ts'] })

    expect(config).toEqual({ entry: ['src/**/*.ts'] })
  })
})
