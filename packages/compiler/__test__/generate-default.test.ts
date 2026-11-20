import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { generate } from '../src/generate.ts'

const CONFIG = `import { defineConfig } from 'monocon/config'\nexport default defineConfig({ entry: ['src/**/*.ts'] })\n`

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-generate-default-'))
  await mkdir(join(dir, 'src', 'routers'), { recursive: true })
  await mkdir(join(dir, 'src', 'middlewares'), { recursive: true })
  await writeFile(join(dir, 'monocon.config.ts'), CONFIG)
  await writeFile(join(dir, 'src', 'index.ts'), `export {}\n`)
  await writeFile(
    join(dir, 'src', 'routers', 'index.ts'),
    files['routers'] ?? `export default []\n`,
  )
  await writeFile(
    join(dir, 'src', 'middlewares', 'index.ts'),
    files['middlewares'] ?? `export default []\n`,
  )
  return dir
}

async function read(dir: string, name: string): Promise<string> {
  return readFile(join(dir, '.monocon', name), 'utf8')
}

describe('generate default exports', () => {
  it('generates the entry and three declaration files', async () => {
    const dir = await fixture({
      routers: `export const health = get('/health', {}).handle(() => ({}))
export default [health]`,
      middlewares: `export const logger = defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '*')
export default [logger]`,
    })

    const result = await generate(dir, 'monocon.config.ts')

    expect(result.files.map((file) => file.path)).toEqual([
      join(dir, '.monocon', 'types.d.ts'),
      join(dir, '.monocon', 'middlewares.d.ts'),
      join(dir, '.monocon', 'errors.d.ts'),
      join(dir, '.monocon', 'routes.d.ts'),
    ])
    const types = await read(dir, 'types.d.ts')
    expect(types).toContain("import './middlewares.js'")
    expect(types).toContain("import './errors.js'")
    expect(types).toContain("import './routes.js'")
  })

  it('references a middleware by its export name in generated types', async () => {
    const dir = await fixture({
      routers: `export const health = get('/health', {}).handle(() => ({}))
export default [health]`,
      middlewares: `export const logger = defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '*')
export default [logger]`,
    })

    await generate(dir, 'monocon.config.ts')
    const middlewares = await read(dir, 'middlewares.d.ts')

    expect(middlewares).toMatch(/import \{ logger \} from '.*middlewares\/index\.js'/)
    expect(middlewares).toContain(`"GET /health": (typeof logger)['~provided']`)
  })

  it('emits empty context blocks when the arrays are empty', async () => {
    const dir = await fixture({
      routers: `export default []`,
      middlewares: `export default []`,
    })

    await generate(dir, 'monocon.config.ts')

    expect(await read(dir, 'middlewares.d.ts')).toContain('interface RouteMiddlewareContext {')
    expect(await read(dir, 'errors.d.ts')).toContain('interface ErrorMap {')
    expect(await read(dir, 'routes.d.ts')).toContain('interface RouteRecords {')
  })
})
