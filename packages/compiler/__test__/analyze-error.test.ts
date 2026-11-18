import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { analyzeEntries } from '../src/analyze.ts'

async function entry(text: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'monocon-analyze-'))
  const file = join(dir, 'errors.ts')
  await writeFile(file, text)
  return file
}

describe('analyze error declarations', () => {
  it('collects exported defineError() factories', async () => {
    const file = await entry(`import { defineError } from 'monocon'
export const Conflict = defineError({ status: 409, error: {} })
export const Gone = defineError({ status: 410, error: {} })
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'error', file, exportName: 'Conflict', name: undefined },
      { kind: 'error', file, exportName: 'Gone', name: undefined },
    ])
  })

  it('reads an explicit name property', async () => {
    const file = await entry(`import { defineError } from 'monocon'
export const Conflict = defineError({ name: 'CONFLICT', status: 409, error: {} })
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'error', file, exportName: 'Conflict', name: 'CONFLICT' },
    ])
  })

  it('ignores defineError() calls that are not exported', async () => {
    const file = await entry(`import { defineError } from 'monocon'
const internal = defineError({ status: 500, error: {} })
export const Public = defineError({ status: 400, error: {} })
`)
    const result = await analyzeEntries([file])

    expect(result.declarations).toEqual([
      { kind: 'error', file, exportName: 'Public', name: undefined },
    ])
  })
})
