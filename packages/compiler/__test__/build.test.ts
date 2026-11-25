import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { build } from '../src/build.ts'

async function createProject(): Promise<{ root: string; configPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'monocon-build-'))
  const configPath = join(root, 'monocon.config.ts')
  await writeFile(configPath, `export default { entry: ['src/**/*.ts'] }\n`)
  await mkdir(join(root, 'src/routes'), { recursive: true })
  await writeFile(
    join(root, 'src/routes/users.ts'),
    `export const META = { prefix: '/api' } as const
export const INJECTS = { auth: { beforeHandle: () => ({ user: 'admin' }) } }`,
  )
  await mkdir(join(root, '.monocon/modules'), { recursive: true })
  await writeFile(join(root, '.monocon/modules/stale.ts.d.ts'), 'stale')
  return { root, configPath }
}

describe('build', () => {
  it('writes declarations and removes stale generated files', async () => {
    const { root, configPath } = await createProject()

    const result = await build(configPath)

    expect(result.moduleCount).toBe(1)
    const generated = await readFile(
      join(root, '.monocon/modules/src_routes_users.ts.d.ts'),
      'utf8',
    )
    expect(generated).toContain('const get: RouteBuilder<Meta, Injects>')
    await expect(readFile(join(root, '.monocon/modules/stale.ts.d.ts'), 'utf8')).rejects.toThrow(
      'ENOENT',
    )
  })

  it('updates declarations when a module no longer exports META', async () => {
    const { root, configPath } = await createProject()
    await build(configPath)
    await writeFile(
      join(root, 'src/routes/users.ts'),
      `export const INJECTS = { auth: { beforeHandle: () => ({ user: 'admin' }) } }`,
    )

    const result = await build(configPath)

    expect(result.moduleCount).toBe(0)
    await expect(
      readFile(join(root, '.monocon/modules/src_routes_users.ts.d.ts'), 'utf8'),
    ).rejects.toThrow('ENOENT')
    await expect(readFile(join(root, '.monocon/index.d.ts'), 'utf8')).resolves.toBe('')
  })
})
