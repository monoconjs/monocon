import { relative, resolve, sep } from 'node:path'

import type { AnalyzeResult } from './analyze.ts'
import type { LoadedConfig } from './config.ts'
import type { GeneratedFile } from './generate.ts'

interface RuntimeModule {
  readonly file: string
  readonly relativePath: string
}

const HEADER = [
  '// @ts-nocheck',
  '/* eslint-disable */',
  '/* oxlint-disable */',
  '/* prettier-ignore */',
  '/* oxfmt-ignore */',
]

export function generateRuntime(result: AnalyzeResult, config: LoadedConfig): GeneratedFile[] {
  const modules = collectModules(result, config)
  const globalModule = result.globalModule

  const imports = [
    "import { createApp, createRouteBuilder, registerModule, type RouteMethod } from 'monocon'",
  ]

  const globals = [
    'const GLOBAL_METHODS: Record<string, RouteMethod> = {',
    "  get: 'GET',",
    "  post: 'POST',",
    "  put: 'PUT',",
    "  patch: 'PATCH',",
    "  del: 'DELETE',",
    "  head: 'HEAD',",
    "  options: 'OPTIONS',",
    "  all: 'ALL',",
    '}',
    '',
    'const globalObject = globalThis as Record<string, unknown>',
    'const previousGlobals = new Map<string, PropertyDescriptor | undefined>()',
    '',
    'for (const [name, method] of Object.entries(GLOBAL_METHODS)) {',
    '  previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalObject, name))',
    '  Object.defineProperty(globalObject, name, {',
    '    value: createRouteBuilder(method),',
    '    writable: true,',
    '    configurable: true,',
    '  })',
    '}',
    '',
  ]

  const moduleImports = modules.map(
    (module, index) => `const __module${index} = __modules[${index}]`,
  )

  const loaders = [
    modules.length === 0
      ? 'await (async () => {\n  try {\n    return []\n  } finally {\n    restoreGlobals()\n  }\n})()'
      : [
          'const __modules = await (async () => {',
          '  try {',
          '    return await Promise.all([',
          ...modules.map((module) => `      import('${toSpecifier(config.outDir, module.file)}'),`),
          '    ])',
          '  } finally {',
          '    restoreGlobals()',
          '  }',
          '})()',
        ].join('\n'),
  ]

  const restore = [
    'function restoreGlobals() {',
    '  for (const [name, descriptor] of previousGlobals) {',
    '    if (descriptor === undefined) {',
    '      delete globalObject[name]',
    '    } else {',
    '      Object.defineProperty(globalObject, name, descriptor)',
    '    }',
    '  }',
    '}',
  ]

  const sources = modules.map(
    (module, index) => `const __source${index} = __module${index} as Record<string, any>`,
  )

  const globalInjects = [
    'function injectsOf(source: Record<string, any>) {',
    "  return typeof source.INJECTS === 'object' && source.INJECTS !== null ? source.INJECTS : {}",
    '}',
    '',
    `const __globalInjects = ${
      globalModule === undefined
        ? '{}'
        : `injectsOf(__source${moduleIndex(modules, globalModule.file)})`
    }`,
  ]

  const registrations = modules.flatMap((module, index) => {
    const routes = (result.routes ?? []).filter((route) => route.file === module.file)
    const lines = [
      'registerModule({',
      `  id: '${module.relativePath}',`,
      `  meta: __source${index}.META,`,
      `  injects: { ...injectsOf(__source${index}), ...__globalInjects },`,
    ]

    if (routes.length > 0) {
      lines.push('  routes: [')
      for (const route of routes) lines.push(`    __source${index}.${route.name},`)
      lines.push("  ] as NonNullable<Parameters<typeof registerModule>[0]['routes']>,")
    }

    lines.push('})')
    return lines
  })

  return [
    {
      path: resolve(config.outDir, 'app.ts'),
      content: [
        ...HEADER,
        '',
        ...imports,
        '',
        ...globals,
        ...loaders,
        ...moduleImports,
        '',
        ...restore,
        '',
        ...sources,
        '',
        ...globalInjects,
        '',
        ...registrations,
        '',
        'export const app = createApp()',
        '',
      ].join('\n'),
    },
  ]
}

function collectModules(result: AnalyzeResult, config: LoadedConfig): RuntimeModule[] {
  const modules = new Map<string, RuntimeModule>()

  for (const module of result.modules) {
    modules.set(module.file, { file: module.file, relativePath: module.relativePath })
  }
  if (result.globalModule !== undefined) {
    const module = result.globalModule
    modules.set(module.file, { file: module.file, relativePath: module.relativePath })
  }
  for (const route of result.routes ?? []) {
    if (modules.has(route.file)) continue
    modules.set(route.file, {
      file: route.file,
      relativePath: relative(config.rootDir, route.file).split(sep).join('/'),
    })
  }

  return [...modules.values()].toSorted((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  )
}

function moduleIndex(modules: readonly RuntimeModule[], file: string): number {
  return modules.findIndex((module) => module.file === file)
}

function toSpecifier(fromDir: string, file: string): string {
  const specifier = relative(fromDir, file).split(sep).join('/')
  return specifier.startsWith('.') ? specifier : `./${specifier}`
}
