import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import * as ts from 'typescript'

export const DEFAULT_CONFIG_FILE = 'monocon.config.ts'
export const DEFAULT_OUT_DIR = '.monocon'

export interface MonoconConfig {
  entry: string[]
  outDir?: string
}

export interface LoadedConfig {
  rootDir: string
  configPath: string
  entry: string[]
  outDir: string
}

export function defineConfig(config: MonoconConfig): MonoconConfig {
  return config
}

export async function loadConfig(path: string = DEFAULT_CONFIG_FILE): Promise<LoadedConfig> {
  const configPath = resolve(path)
  const text = await readFile(configPath, 'utf8').catch(() => {
    throw new Error(`Config not found: ${configPath}`)
  })

  const source = ts.createSourceFile(configPath, text, ts.ScriptTarget.Latest, true)
  const object = readDefaultExport(source, configPath)
  const entry = readEntry(object, configPath)
  const outDir = readOutDir(object)

  return {
    rootDir: dirname(configPath),
    configPath,
    entry: entry.map((item) => resolve(dirname(configPath), item)),
    outDir: resolve(dirname(configPath), outDir),
  }
}

function readDefaultExport(source: ts.SourceFile, path: string): ts.ObjectLiteralExpression {
  const statement = source.statements.find(
    (item): item is ts.ExportAssignment => ts.isExportAssignment(item) && !item.isExportEquals,
  )
  if (statement === undefined) throw new Error(`No default export found in ${path}`)

  const expression = unwrapObject(statement.expression)
  if (expression === undefined) {
    throw new Error(`Default export must be an object literal in ${path}`)
  }
  return expression
}

function unwrapObject(expression: ts.Expression): ts.ObjectLiteralExpression | undefined {
  if (ts.isObjectLiteralExpression(expression)) return expression

  if (ts.isCallExpression(expression)) {
    const [argument] = expression.arguments
    if (argument !== undefined && ts.isObjectLiteralExpression(argument)) return argument
  }

  return undefined
}

function readEntry(object: ts.ObjectLiteralExpression, path: string): string[] {
  const property = findProperty(object, 'entry')
  if (
    property === undefined ||
    !ts.isPropertyAssignment(property) ||
    !ts.isArrayLiteralExpression(property.initializer)
  ) {
    throw new Error(`entry must be a string array in ${path}`)
  }

  const entry = property.initializer.elements.map((element) => {
    if (!ts.isStringLiteral(element))
      throw new Error(`entry must contain string literals in ${path}`)
    return element.text
  })
  if (entry.length === 0) throw new Error(`entry is empty in ${path}`)

  return entry
}

function readOutDir(object: ts.ObjectLiteralExpression): string {
  const build = findProperty(object, 'outDir')
  if (build === undefined) return DEFAULT_OUT_DIR
  if (!ts.isPropertyAssignment(build) || !ts.isStringLiteral(build.initializer)) {
    return DEFAULT_OUT_DIR
  }
  return build.initializer.text
}

function findProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name,
  )
}
