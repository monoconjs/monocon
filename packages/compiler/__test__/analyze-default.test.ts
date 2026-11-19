import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { analyzeEntries } from '../src/analyze.ts'

async function entry(text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-default-'))
  const file = join(dir, 'middlewares.ts')
  await writeFile(file, text)
  return file
}

describe('analyze default exports', () => {
  it('collects a named and an inline default middleware in the same file', async () => {
    const file = await entry(`import { defineMiddleware } from 'monocon'
export const named = defineMiddleware({}, '/a/*')
export default defineMiddleware({}, '/b/*')
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'middleware', file, exportName: 'named', pattern: { kind: 'glob', value: '/a/*' } },
      {
        kind: 'middleware',
        file,
        exportName: '__default_0',
        pattern: { kind: 'glob', value: '/b/*' },
        default: true,
      },
    ])
  })

  it('collects an identifier default export', async () => {
    const file = await entry(`import { defineMiddleware } from 'monocon'
const anonymous = defineMiddleware({}, '/c/*')
export default anonymous
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      {
        kind: 'middleware',
        file,
        exportName: '__default_0',
        pattern: { kind: 'glob', value: '/c/*' },
        default: true,
      },
    ])
  })

  it('collects an export-list default alias', async () => {
    const file = await entry(`import { defineMiddleware } from 'monocon'
const anonymous = defineMiddleware({}, '/d/*')
export { anonymous as default }
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      {
        kind: 'middleware',
        file,
        exportName: '__default_0',
        pattern: { kind: 'glob', value: '/d/*' },
        default: true,
      },
    ])
  })

  it('assigns sequential aliases across files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-default-'))
    const a = join(dir, 'a.ts')
    const b = join(dir, 'b.ts')
    const head = `import { defineMiddleware } from 'monocon'\n`
    await writeFile(a, head + `export default defineMiddleware({}, '/a/*')\n`)
    await writeFile(b, head + `export default defineMiddleware({}, '/b/*')\n`)

    const result = await analyzeEntries([a, b])
    const defaults = result.declarations.filter((item) => item.default)

    expect(defaults.map((item) => item.exportName)).toEqual(['__default_0', '__default_1'])
  })

  it('ignores a default export that is not a factory call', async () => {
    const file = await entry(`export default { some: 'object' }
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([])
    expect(result.warnings).toEqual([])
  })
})
