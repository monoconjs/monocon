import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { generate } from '../src/generate.ts'

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-generate-'))
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

describe('generate method-aware middleware context', () => {
  it('emits a composite key per method and path', async () => {
    const dir = await fixture({
      'routes.ts': `export const readUser = get('/users/:id', {}).handle(() => ({}))
export const removeUser = del('/users/:id', {}).handle(() => ({}))
export const health = get('/health', {}).handle(() => ({}))`,
      'middlewares.ts': `export const readAuth = defineMiddleware({ onRequest: () => ({ read: true }) }, 'GET /users/*')
export const writeAuth = defineMiddleware({ onRequest: () => ({ write: true }) }, 'DELETE /users/*')`,
    })

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'types.d.ts'), 'utf8')

    expect(types).toContain('"GET /users/:id": (typeof readAuth)[\'~provided\']')
    expect(types).toContain('"DELETE /users/:id": (typeof writeAuth)[\'~provided\']')
    expect(types).not.toContain('"GET /users/:id": (typeof writeAuth)')

    expect(types).not.toContain('"GET /health"')
  })

  it('keeps unprefixed patterns matching every method', async () => {
    const dir = await fixture({
      'routes.ts': `export const readUser = get('/users/:id', {}).handle(() => ({}))
export const removeUser = del('/users/:id', {}).handle(() => ({}))`,
      'middlewares.ts': `export const logger = defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '/users/*')`,
    })

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'types.d.ts'), 'utf8')

    expect(types).toContain('"GET /users/:id": (typeof logger)[\'~provided\']')
    expect(types).toContain('"DELETE /users/:id": (typeof logger)[\'~provided\']')
  })
})
