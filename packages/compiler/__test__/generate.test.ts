import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { AnalyzeResult } from '../src/analyze.ts'
import type { LoadedConfig } from '../src/config.ts'
import { generateDeclarations } from '../src/generate.ts'

const root = '/project'
const source = join(root, 'src/routes/users.ts')
const globalSource = join(root, 'src/injects/global.ts')
const config: LoadedConfig = {
  rootDir: root,
  configPath: join(root, 'monocon.config.ts'),
  entry: [source],
  outDir: join(root, '.monocon'),
}

describe('generateDeclarations', () => {
  it('generates a declaration that specializes route methods for a module', () => {
    const result: AnalyzeResult = {
      modules: [
        {
          file: source,
          relativePath: 'src/routes/users.ts',
          hasMeta: true,
          hasInjects: true,
          hasGlobalInject: false,
        },
      ],
    }

    const files = generateDeclarations(result, config)
    const declaration = files.find((file) => file.path.endsWith('src_routes_users.ts.d.ts'))

    expect(declaration?.content).toContain(
      "import type * as SOURCE from '../../src/routes/users.ts'",
    )
    expect(declaration?.content).toContain('type Meta = typeof SOURCE.META')
    expect(declaration?.content).toContain(
      "type LocalInjects = 'INJECTS' extends keyof typeof SOURCE ? typeof SOURCE.INJECTS : {}",
    )
    expect(declaration?.content).toContain('const get: RouteBuilder<Meta, Injects>')
    expect(declaration?.content).toContain('const options: RouteBuilder<Meta, Injects>')
    expect(files.find((file) => file.path.endsWith('index.d.ts'))?.content).toContain(
      '/// <reference path="./modules/src_routes_users.ts.d.ts" />',
    )
  })

  it('merges the global inject source into every module', () => {
    const result: AnalyzeResult = {
      modules: [
        {
          file: source,
          relativePath: 'src/routes/users.ts',
          hasMeta: true,
          hasInjects: true,
          hasGlobalInject: false,
        },
      ],
      globalModule: {
        file: globalSource,
        relativePath: 'src/injects/global.ts',
        hasMeta: false,
        hasInjects: true,
        hasGlobalInject: true,
      },
    }

    const declaration = generateDeclarations(result, config)[0]

    expect(declaration?.content).toContain(
      "import type * as GLOBAL from '../../src/injects/global.ts'",
    )
    expect(declaration?.content).toContain(
      "type Injects = Omit<LocalInjects, '__global'> & Omit<GlobalInjects, '__global'>",
    )
  })

  it('does not import the global source into its own module', () => {
    const module = {
      file: source,
      relativePath: 'src/routes/users.ts',
      hasMeta: true,
      hasInjects: true,
      hasGlobalInject: true,
    }
    const result: AnalyzeResult = { modules: [module], globalModule: module }

    const declaration = generateDeclarations(result, config)[0]

    expect(declaration?.content).not.toContain('import type * as GLOBAL')
    expect(declaration?.content).toContain("type Injects = Omit<LocalInjects, '__global'>")
  })
})
