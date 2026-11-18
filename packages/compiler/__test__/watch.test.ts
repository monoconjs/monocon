import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { DirectoryStat } from '../src/watch.ts'
import { clearScreen, isIgnored, isSource, staticBase, watchTargets } from '../src/watch.ts'

const dir = (): DirectoryStat => ({ isDirectory: () => true })
const file = (): DirectoryStat => ({ isDirectory: () => false })

describe('clearScreen', () => {
  it('delegates to console.clear', () => {
    const clear = vi.spyOn(console, 'clear').mockImplementation(() => undefined)

    clearScreen()

    expect(clear).toHaveBeenCalledOnce()
    clear.mockRestore()
  })
})

describe('staticBase', () => {
  it('returns the static prefix of an absolute glob', () => {
    expect(staticBase('/project/src/**/*.ts')).toBe('/project/src')
  })

  it('stops at the first segment containing glob magic', () => {
    expect(staticBase('/project/{src,test}/*.ts')).toBe('/project')
  })

  it('normalizes Windows-style separators', () => {
    expect(staticBase('\\project\\src\\**\\*.ts')).toBe('/project/src')
  })

  it('turns a concrete file path into its parent directory', () => {
    expect(staticBase('/project/src/index.ts')).toBe('/project/src')
  })

  it('falls back to the filesystem root for an absolute pattern without a static prefix', () => {
    expect(staticBase('/**/*.ts')).toBe('/')
  })

  it('falls back to the current directory for a relative pattern without a static prefix', () => {
    expect(staticBase('*.ts')).toBe('.')
  })
})

describe('isSource', () => {
  it.each([
    'file.ts',
    'file.mts',
    'file.cts',
    'file.tsx',
    'file.js',
    'file.mjs',
    'file.cjs',
    'file.json',
  ])('accepts %s', (path) => {
    expect(isSource(path)).toBe(true)
  })

  it('is case insensitive for the extension', () => {
    expect(isSource('file.TS')).toBe(true)
  })

  it.each(['file.md', 'file.css', 'file'])('rejects %s', (path) => {
    expect(isSource(path)).toBe(false)
  })
})

describe('isIgnored', () => {
  const ignored = new Set(['.monocon', 'node_modules', 'dist', 'custom-out'])

  it('ignores paths containing an ignored segment', () => {
    expect(isIgnored('/project/src/app.ts', undefined, ignored)).toBe(false)
    expect(isIgnored('/project/node_modules/pkg/index.ts', undefined, ignored)).toBe(true)
    expect(isIgnored('/project/.monocon/registry.mjs', undefined, ignored)).toBe(true)
    expect(isIgnored('/project/custom-out/index.js', undefined, ignored)).toBe(true)
  })

  it('matches ignored segments case insensitively', () => {
    expect(isIgnored('/project/NODE_MODULES/pkg.ts', undefined, ignored)).toBe(true)
  })

  it('normalizes Windows-style separators', () => {
    expect(isIgnored('\\project\\dist\\bundle.js', undefined, ignored)).toBe(true)
  })

  it('ignores non-source files when stats are available', () => {
    expect(isIgnored('/project/README.md', file(), ignored)).toBe(true)
    expect(isIgnored('/project/src/app.ts', file(), ignored)).toBe(false)
  })

  it('keeps directories so chokidar can traverse them', () => {
    expect(isIgnored('/project/src/notes.md', dir(), ignored)).toBe(false)
  })

  it('does not filter by extension when stats are unavailable', () => {
    expect(isIgnored('/project/README.md', undefined, ignored)).toBe(false)
  })
})

describe('watchTargets', () => {
  it('includes the config file and static bases of entry patterns', async () => {
    const configPath = resolve('/project', 'monocon.config.ts')

    const targets = await watchTargets(configPath, ['/project/src/**/*.ts'])

    expect(targets).toContain(configPath)
    expect(targets).toContain('/project/src')
  })

  it('adds the directories of expanded entry files', async () => {
    const pattern = resolve('src', '**', '*.ts')

    const targets = await watchTargets('/project/monocon.config.ts', [pattern])

    expect(targets).toContain(resolve('src'))
  })

  it('deduplicates overlapping targets', async () => {
    const pattern = resolve('src', '**', '*.ts')

    const targets = await watchTargets('/project/monocon.config.ts', [pattern, pattern])

    expect(new Set(targets).size).toBe(targets.length)
  })
})
