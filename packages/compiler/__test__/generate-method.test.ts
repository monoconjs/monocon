import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { generate } from '../src/generate.ts'

async function fixture(routes: string, middlewares: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-generate-'))
  await mkdir(join(dir, 'src', 'routers'), { recursive: true })
  await mkdir(join(dir, 'src', 'middlewares'), { recursive: true })
  await writeFile(
    join(dir, 'monocon.config.ts'),
    `import { defineConfig } from 'monocon/config'\nexport default defineConfig({ entry: ['src/**/*.ts'] })\n`,
  )
  await writeFile(join(dir, 'src', 'index.ts'), `export {}\n`)
  await writeFile(join(dir, 'src', 'routers', 'index.ts'), routes)
  await writeFile(join(dir, 'src', 'middlewares', 'index.ts'), middlewares)
  return dir
}

describe('generate method-aware middleware context', () => {
  it('emits a composite key per method and path in array order', async () => {
    const dir = await fixture(
      `export const readUser = get('/users/:id', {}).handle(() => ({}))
export const removeUser = del('/users/:id', {}).handle(() => ({}))
export const health = get('/health', {}).handle(() => ({}))
export default [readUser, removeUser, health]`,
      `export const readAuth = defineMiddleware({ onRequest: () => ({ read: true }) }, 'GET /users/*')
export const writeAuth = defineMiddleware({ onRequest: () => ({ write: true }) }, 'DELETE /users/*')
export default [readAuth, writeAuth]`,
    )

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'middlewares.d.ts'), 'utf8')

    expect(types).toContain('"GET /users/:id": (typeof readAuth)[\'~provided\']')
    expect(types).toContain('"DELETE /users/:id": (typeof writeAuth)[\'~provided\']')
    expect(types).not.toContain('"GET /users/:id": (typeof writeAuth)')
    expect(types).not.toContain('"GET /health"')
  })

  it('keeps unprefixed patterns matching every method', async () => {
    const dir = await fixture(
      `export const readUser = get('/users/:id', {}).handle(() => ({}))
export const removeUser = del('/users/:id', {}).handle(() => ({}))
export default [readUser, removeUser]`,
      `export const logger = defineMiddleware({ onRequest: () => ({ trace: 'x' }) }, '/users/*')
export default [logger]`,
    )

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'middlewares.d.ts'), 'utf8')

    expect(types).toContain('"GET /users/:id": (typeof logger)[\'~provided\']')
    expect(types).toContain('"DELETE /users/:id": (typeof logger)[\'~provided\']')
  })

  it('supports destructured group factories', async () => {
    const dir = await fixture(
      `const { get } = defineGroup('/users')
export const getUser = get('/:id').handle(() => ({}))
export default [getUser]`,
      `export const logger = defineMiddleware({ onRequest: () => ({ requestId: 'req-1' }) }, '*')
export default [logger]`,
    )

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'middlewares.d.ts'), 'utf8')

    expect(types).toContain('"GET /users/:id": (typeof logger)[\'~provided\']')
  })

  it('uses prefixed paths for group routes', async () => {
    const dir = await fixture(
      `const api = defineGroup('/api')
export const listUsers = api.get('/users').handle(() => ({}))
export default [listUsers]`,
      `export const readAuth = defineMiddleware({ onRequest: () => ({ read: true }) }, 'GET /api/users')
export default [readAuth]`,
    )

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'middlewares.d.ts'), 'utf8')

    expect(types).toContain('"GET /api/users": (typeof readAuth)[\'~provided\']')
    expect(types).not.toContain('"GET /users"')
  })

  it('respects the middleware array order in the provided intersection', async () => {
    const dir = await fixture(
      `export const page = get('/page').handle(() => ({}))
export default [page]`,
      `export const first = defineMiddleware({ onRequest: () => ({ a: 1 }) }, '/page')
export const second = defineMiddleware({ onRequest: () => ({ b: 2 }) }, '/page')
export default [first, second]`,
    )

    await generate(dir, 'monocon.config.ts')
    const types = await readFile(join(dir, '.monocon', 'middlewares.d.ts'), 'utf8')

    const line = types.split('\n').find((row) => row.includes('"GET /page":'))!
    expect(line.indexOf('first')).toBeLessThan(line.indexOf('second'))
  })
})
