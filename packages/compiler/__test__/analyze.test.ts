import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { analyzeSources, expandEntries } from '../src/analyze.ts'

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'monocon-analyze-'))
  await Promise.all(
    Object.entries(files).map(async ([name, content]) => {
      const path = join(root, name)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, content)
    }),
  )
  return root
}

describe('expandEntries', () => {
  it('matches glob patterns and skips missing literal paths', async () => {
    const root = await createProject({
      'src/routes/users.ts': 'export const META = {}',
      'src/routes/posts.ts': 'export const META = {}',
      'src/other.ts': 'export const value = 1',
    })

    const files = await expandEntries(['src/**/*.ts', 'src/missing.ts'], root)

    expect(files.map((file) => relative(root, file).split(sep).join('/'))).toEqual([
      'src/other.ts',
      'src/routes/posts.ts',
      'src/routes/users.ts',
    ])
  })
})

describe('analyzeSources', () => {
  it('detects route modules and the global inject source', async () => {
    const root = await createProject({
      'src/routes/users.ts': `export const META = { prefix: '/api' }
export const INJECTS = { auth: { beforeHandle: () => ({ user: 'admin' }) } }`,
      'src/injects/global.ts': `export const INJECTS = {
  __global: true,
  logger: { beforeHandle: () => ({ requestId: '1' }) },
} as const`,
      'src/injects/factory.ts': `export const makeAuth = () => ({ __global: true })`,
      'src/utils.ts': 'export const value = 1',
    })

    const result = await analyzeSources(
      [
        join(root, 'src/routes/users.ts'),
        join(root, 'src/injects/global.ts'),
        join(root, 'src/injects/factory.ts'),
        join(root, 'src/utils.ts'),
      ],
      root,
    )

    expect(result.modules.map((module) => module.relativePath)).toEqual(['src/routes/users.ts'])
    expect(result.modules[0]?.hasInjects).toBe(true)
    expect(result.globalModule?.relativePath).toBe('src/injects/global.ts')
  })

  it('collects exported route calls with their module prefixes', async () => {
    const root = await createProject({
      'src/routes/users.ts': `export const META = { prefix: '/api/users' } as const
export const getUser = get('/:id', () => ({}))
const list = post('/', () => ({}))
export { list }
export const helper = () => get('/ignored', () => ({}))`,
    })
    const file = join(root, 'src/routes/users.ts')

    const result = await analyzeSources([file], root)

    expect(result.routes).toEqual([
      { file, name: 'list', method: 'post', path: '/api/users/' },
      { file, name: 'getUser', method: 'get', path: '/api/users/:id' },
    ])
  })

  it('reads prefixes from meta helper calls', async () => {
    const root = await createProject({
      'src/routes/users.ts': `export const META = meta({ prefix: '/api/users' })
export const getUser = get('/:id', () => ({}))`,
    })
    const file = join(root, 'src/routes/users.ts')

    const result = await analyzeSources([file], root)

    expect(result.modules[0]?.hasMeta).toBe(true)
    expect(result.routes).toEqual([
      { file, name: 'getUser', method: 'get', path: '/api/users/:id' },
    ])
  })

  it('rejects multiple global inject sources with wrapped flags', async () => {
    const root = await createProject({
      'src/a.ts': 'export const INJECTS = { __global: true as const }',
      'src/b.ts': 'export const INJECTS = { __global: (true) } satisfies object',
    })

    await expect(
      analyzeSources([join(root, 'src/a.ts'), join(root, 'src/b.ts')], root),
    ).rejects.toThrow('Multiple global INJECTS found')
  })

  it('supports named re-exports', async () => {
    const root = await createProject({
      'src/routes/users.ts': `const META = { prefix: '/api' }
export { META }`,
    })

    const result = await analyzeSources([join(root, 'src/routes/users.ts')], root)

    expect(result.modules).toHaveLength(1)
  })

  it('rejects multiple global inject sources', async () => {
    const root = await createProject({
      'src/a.ts': 'export const INJECTS = { __global: true }',
      'src/b.ts': 'export const INJECTS = { __global: true }',
    })

    await expect(
      analyzeSources([join(root, 'src/a.ts'), join(root, 'src/b.ts')], root),
    ).rejects.toThrow('Multiple global INJECTS found')
  })
})
