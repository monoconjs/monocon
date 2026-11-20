import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readOrderedNames } from '../src/analyze.ts'

async function entry(text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-ordered-'))
  const file = join(dir, 'index.ts')
  await writeFile(file, text)
  return file
}

describe('readOrderedNames', () => {
  it('reads identifiers from export default array in source order', async () => {
    const file = await entry(`export const a = 1
export const b = 2
export default [a, b, a]
`)
    expect(await readOrderedNames(file)).toEqual(['a', 'b', 'a'])
  })

  it('expands a bare namespace element to all named exports of the imported file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-ordered-'))
    const routesFile = join(dir, 'routes.ts')
    const entryFile = join(dir, 'index.ts')
    await writeFile(
      routesFile,
      `export const getUser = 1\nexport const createUser = 2\nexport const health = 3\n`,
    )
    await writeFile(entryFile, `import * as routes from './routes.ts'\nexport default [routes]\n`)

    expect(await readOrderedNames(entryFile)).toEqual(['getUser', 'createUser', 'health'])
  })

  it('reads namespace-qualified elements (import * as routes)', async () => {
    const file = await entry(`import * as routes from '../routes/index.ts'
export default [routes.getUser, routes.createUser, routes.getUser]
`)
    expect(await readOrderedNames(file)).toEqual(['getUser', 'createUser', 'getUser'])
  })

  it('returns an empty list when default export is not an array', async () => {
    const file = await entry(`export default { a: 1 }\n`)
    expect(await readOrderedNames(file)).toEqual([])
  })

  it('returns an empty list when there is no default export', async () => {
    const file = await entry(`export const a = 1\n`)
    expect(await readOrderedNames(file)).toEqual([])
  })
})
