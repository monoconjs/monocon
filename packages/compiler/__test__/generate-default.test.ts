import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { generate } from '../src/generate.ts'

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-generate-default-'))
  await mkdir(join(dir, 'src'), { recursive: true })
  await writeFile(
    join(dir, 'monocon.config.ts'),
    `import { defineConfig } from 'monocon/config'\nexport default defineConfig({ entry: ['src/**/*.ts'] })\n`,
  )
  await Promise.all(
    Object.entries(files).map(([name, text]) => writeFile(join(dir, 'src', name), text)),
  )
  return dir
}

async function read(dir: string, name: string): Promise<string> {
  return readFile(join(dir, '.monocon', name), 'utf8')
}

describe('generate default exports', () => {
  it('forwards default exports through the registry with their aliases', async () => {
    const dir = await fixture({
      'routes.ts': `export const health = get('/health', {}).handle(() => ({}))`,
      'middlewares.ts': `export default defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '*')`,
    })

    await generate(dir, 'monocon.config.ts')
    const registry = await read(dir, 'registry.mjs')
    const registryTypes = await read(dir, 'registry.d.mts')

    expect(registry).toMatch(/export \{ default as __default_0 \} from '.*middlewares\.js'/)
    expect(registryTypes).toMatch(/export \{ default as __default_0 \} from '.*middlewares\.js'/)
  })

  it('references the default middleware by alias in generated types', async () => {
    const dir = await fixture({
      'routes.ts': `export const health = get('/health', {}).handle(() => ({}))`,
      'middlewares.ts': `export default defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '*')`,
    })

    await generate(dir, 'monocon.config.ts')
    const types = await read(dir, 'types.d.ts')

    expect(types).toMatch(/import \{ default as __default_0 \} from '.*middlewares\.js'/)
    expect(types).toContain(`"GET /health": (typeof __default_0)['~provided']`)
  })

  it('references a default route through its namespace default', async () => {
    const dir = await fixture({
      'route.ts': `export default get('/health', {}).handle(() => ({}))`,
    })

    await generate(dir, 'monocon.config.ts')
    const types = await read(dir, 'types.d.ts')

    expect(types).toContain('get: typeof __routes_0.default')
  })
})
