import { basename, relative, resolve, sep } from 'node:path'

import type { AnalyzeResult, SourceModule } from './analyze.ts'
import type { LoadedConfig } from './config.ts'

export interface GeneratedFile {
  path: string
  content: string
}

const METHODS = ['get', 'post', 'put', 'patch', 'del', 'head', 'options']

export function generateDeclarations(result: AnalyzeResult, config: LoadedConfig): GeneratedFile[] {
  const modulesDir = resolve(config.outDir, 'modules')

  const files = result.modules.map((module) => {
    const source = toSpecifier(modulesDir, module.file)
    const global = globalSpecifier(modulesDir, module, result.globalModule)
    const injects =
      global === undefined
        ? "type Injects = Omit<LocalInjects, '__global'>"
        : `type GlobalInjects = 'INJECTS' extends keyof typeof GLOBAL ? typeof GLOBAL.INJECTS : {}\ntype Injects = Omit<LocalInjects, '__global'> & Omit<GlobalInjects, '__global'>`

    const imports = [
      "import type { RouteBuilder } from '@monocon/core'",
      `import type * as SOURCE from '${source}'`,
    ]
    if (global !== undefined) imports.push(`import type * as GLOBAL from '${global}'`)

    const declarations = METHODS.map(
      (method) => `  const ${method}: RouteBuilder<Meta, Injects>`,
    ).join('\n')

    const content = [
      ...imports,
      '',
      'type Meta = typeof SOURCE.META',
      "type LocalInjects = 'INJECTS' extends keyof typeof SOURCE ? typeof SOURCE.INJECTS : {}",
      ...injects.split('\n'),
      '',
      `declare module '${source}' {`,
      declarations,
      '}',
      '',
    ].join('\n')

    return {
      path: resolve(modulesDir, `${module.relativePath.replaceAll('/', '_')}.d.ts`),
      content,
    }
  })

  const references = files.map(
    (file) => `/// <reference path="./modules/${basename(file.path)}" />`,
  )

  return [
    ...files,
    {
      path: resolve(config.outDir, 'index.d.ts'),
      content: references.length === 0 ? '' : `${references.join('\n')}\n`,
    },
  ]
}

function globalSpecifier(
  modulesDir: string,
  module: SourceModule,
  globalModule: SourceModule | undefined,
): string | undefined {
  if (globalModule === undefined || globalModule.file === module.file) return undefined
  return toSpecifier(modulesDir, globalModule.file)
}

function toSpecifier(fromDir: string, file: string): string {
  const specifier = relative(fromDir, file).split(sep).join('/')
  return specifier.startsWith('.') ? specifier : `./${specifier}`
}
