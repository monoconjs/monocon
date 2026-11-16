import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { glob } from 'tinyglobby'
import * as ts from 'typescript'

export interface MonoconConfig {
  entry: string[]
  build?: {
    outDir?: string
  }
}

export interface LoadedConfig {
  path: string
  entry: string[]
  outDir: string
}

export const DEFAULT_OUT_DIR = '.monocon-dist'

export function defineConfig(config: MonoconConfig): MonoconConfig {
  return config
}

export async function expandEntries(patterns: string[]): Promise<string[]> {
  const groups = await Promise.all(
    patterns.map(async (pattern) => {
      if (!/[*?[\]{}]/.test(pattern)) return [pattern]

      // glob expects POSIX separators, but resolve() emits backslashes on Windows
      const normalized = pattern.replaceAll('\\', '/')
      const files = await glob(normalized, { absolute: true })
      return files.map((file) => resolve(file))
    }),
  )

  return [...new Set(groups.flat())]
}

export async function loadConfig(path: string): Promise<LoadedConfig> {
  const text = await readFile(path, 'utf8').catch(() => {
    throw new Error(`Config not found: ${path}`)
  })

  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const expression = findDefaultExport(source, path)
  const object = unwrapConfig(expression, path)
  const entry = readEntry(object, path)
  const outDir = readOutDir(object)

  return {
    path,
    entry: entry.map((item) => resolve(dirname(path), item)),
    outDir: resolve(dirname(path), outDir),
  }
}

function findDefaultExport(source: ts.SourceFile, path: string): ts.Expression {
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      return statement.expression
    }
  }

  throw new Error(`No default export found in ${path}`)
}

function unwrapConfig(expression: ts.Expression, path: string): ts.ObjectLiteralExpression {
  if (ts.isCallExpression(expression)) {
    const [argument] = expression.arguments
    if (argument && ts.isObjectLiteralExpression(argument)) return argument
  }

  if (ts.isObjectLiteralExpression(expression)) return expression

  throw new Error(`defineConfig() must receive an object literal in ${path}`)
}

function readEntry(object: ts.ObjectLiteralExpression, path: string): string[] {
  const property = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && propertyName(item.name) === 'entry',
  )

  if (
    !property ||
    !ts.isPropertyAssignment(property) ||
    !ts.isArrayLiteralExpression(property.initializer)
  ) {
    throw new Error(`entry must be a string array in ${path}`)
  }

  const entry = property.initializer.elements.map((element) => {
    if (!ts.isStringLiteral(element)) {
      throw new Error(`entry must contain string literals in ${path}`)
    }
    return element.text
  })

  if (entry.length === 0) throw new Error(`entry is empty in ${path}`)

  return entry
}

function readOutDir(object: ts.ObjectLiteralExpression): string {
  const build = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && propertyName(item.name) === 'build',
  )
  if (
    !build ||
    !ts.isPropertyAssignment(build) ||
    !ts.isObjectLiteralExpression(build.initializer)
  ) {
    return DEFAULT_OUT_DIR
  }

  const outDir = build.initializer.properties.find(
    (item) => ts.isPropertyAssignment(item) && propertyName(item.name) === 'outDir',
  )
  if (!outDir || !ts.isPropertyAssignment(outDir) || !ts.isStringLiteral(outDir.initializer)) {
    return DEFAULT_OUT_DIR
  }

  return outDir.initializer.text
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}
