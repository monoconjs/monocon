import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { expandEntries } from '../src/config.ts'

describe('expandEntries', () => {
  it('expands a glob pattern with Windows-style backslash separators', async () => {
    const pattern = resolve('src', '**', '*.ts').replaceAll('/', '\\')

    const files = await expandEntries([pattern])

    expect(files.length).toBeGreaterThan(0)
    expect(files.some((file) => file.endsWith('config.ts'))).toBe(true)
  })

  it('expands a glob pattern with POSIX separators', async () => {
    const pattern = resolve('src', '**', '*.ts')

    const files = await expandEntries([pattern])

    expect(files.length).toBeGreaterThan(0)
  })
})
