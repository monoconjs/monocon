import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { analyzeEntries } from '../src/analyze.ts'

async function entry(text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-group-'))
  const file = join(dir, 'routes.ts')
  await writeFile(file, text)
  return file
}

describe('analyze group routes', () => {
  it('collects group routes with prefixed paths', async () => {
    const file = await entry(`const api = defineGroup('/api')
export const root = api.get('/')
export const one = api.get('/:id').handle(() => ({}))
export default [root, one]
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'route', file, exportName: 'root', method: 'GET', path: '/api' },
      { kind: 'route', file, exportName: 'one', method: 'GET', path: '/api/:id' },
    ])
    expect(result.warnings).toEqual([])
  })

  it('supports nested groups and trailing slashes', async () => {
    const file = await entry(`const api = defineGroup('/api/')
const v1 = api.group('/v1')
export const health = v1.get('/health').handle(() => ({}))
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'route', file, exportName: 'health', method: 'GET', path: '/api/v1/health' },
    ])
  })

  it('warns when a group prefix is not a string literal', async () => {
    const prefix = '/api'
    const file = await entry(`const prefix = '${prefix}'
const api = defineGroup(prefix)
export const health = api.get('/health')
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('group prefix')
  })

  it('does not emit a declaration for the group itself', async () => {
    const file = await entry(`export const api = defineGroup('/api')
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([])
  })
})
