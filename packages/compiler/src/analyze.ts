import { readFile, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

import { glob } from 'tinyglobby'
import * as ts from 'typescript'

export interface SourceModule {
  file: string
  relativePath: string
  hasMeta: boolean
  hasInjects: boolean
  hasGlobalInject: boolean
}

export interface RouteInfo {
  readonly file: string
  readonly name: string
  readonly method: string
  readonly path: string
}

export interface AnalyzeResult {
  modules: SourceModule[]
  globalModule?: SourceModule
  routes?: RouteInfo[]
}

export async function expandEntries(patterns: string[], rootDir: string): Promise<string[]> {
  const groups = await Promise.all(
    patterns.map(async (pattern) => {
      if (!/[*?[\]{}]/.test(pattern)) {
        const file = resolve(rootDir, pattern)
        const isFile = await stat(file)
          .then((info) => info.isFile())
          .catch(() => false)
        return isFile ? [file] : []
      }

      return glob(pattern.replaceAll('\\', '/'), {
        absolute: true,
        cwd: rootDir,
        onlyFiles: true,
      })
    }),
  )

  return [...new Set(groups.flat())].toSorted()
}

export async function analyzeSources(files: string[], rootDir: string): Promise<AnalyzeResult> {
  const sources = await Promise.all(
    files.map(async (file) => {
      const text = await readFile(file, 'utf8').catch(() => {
        throw new Error(`Could not read source file: ${file}`)
      })
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      const meta = findExportedInitializer(source, 'META')
      const injects = findExportedInitializer(source, 'INJECTS')
      const prefix = meta === undefined ? '' : readMetaPrefix(meta)

      return {
        module: {
          file,
          relativePath: relative(rootDir, file).split(sep).join('/'),
          hasMeta: meta !== undefined,
          hasInjects: injects !== undefined,
          hasGlobalInject: injects !== undefined && hasGlobalFlag(injects),
        } satisfies SourceModule,
        routes: findRoutes(source, file, prefix),
      }
    }),
  )

  const globalModules = sources
    .map((item) => item.module)
    .filter((module) => module.hasGlobalInject)
  if (globalModules.length > 1) {
    throw new Error(
      `Multiple global INJECTS found:\n${globalModules.map((module) => `  - ${module.file}`).join('\n')}\n`,
    )
  }

  return {
    modules: sources
      .map((item) => item.module)
      .filter((module) => module.hasMeta)
      .toSorted(compareSource),
    globalModule: globalModules[0],
    routes: sources.flatMap((item) => item.routes).toSorted(compareRoute),
  }
}

function compareSource(left: SourceModule, right: SourceModule): number {
  return left.relativePath.localeCompare(right.relativePath)
}

function compareRoute(left: RouteInfo, right: RouteInfo): number {
  return (
    left.path.localeCompare(right.path) ||
    left.method.localeCompare(right.method) ||
    left.file.localeCompare(right.file)
  )
}

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'del', 'head', 'options', 'all'])

function findExportedInitializer(source: ts.SourceFile, name: string): ts.Expression | undefined {
  return findExportedInitializers(source).get(name)
}

function findExportedInitializers(source: ts.SourceFile): Map<string, ts.Expression> {
  const initializers = new Map<string, ts.Expression>()
  const exports = new Map<string, string>()

  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue
        initializers.set(declaration.name.text, declaration.initializer)
        if (isExported) exports.set(declaration.name.text, declaration.name.text)
      }
      continue
    }

    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier !== undefined ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue
    }

    for (const element of statement.exportClause.elements) {
      exports.set(element.name.text, element.propertyName?.text ?? element.name.text)
    }
  }

  const result = new Map<string, ts.Expression>()
  for (const [name, local] of exports) {
    const initializer = initializers.get(local)
    if (initializer !== undefined) result.set(name, initializer)
  }
  return result
}

function findRoutes(source: ts.SourceFile, file: string, prefix: string): RouteInfo[] {
  const routes: RouteInfo[] = []

  for (const [name, initializer] of findExportedInitializers(source)) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name) || !ts.isCallExpression(initializer)) continue
    const callee = initializer.expression
    if (!ts.isIdentifier(callee) || !ROUTE_METHODS.has(callee.text)) continue

    const [path] = initializer.arguments
    if (path === undefined || !ts.isStringLiteral(path)) continue

    routes.push({
      file,
      name,
      method: callee.text.toLowerCase(),
      path: `${prefix}${path.text}`,
    })
  }

  return routes
}

function readMetaPrefix(expression: ts.Expression): string {
  const object = unwrapObject(expression)
  if (object === undefined) return ''

  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === 'prefix' &&
      ts.isStringLiteral(property.initializer)
    ) {
      return property.initializer.text
    }
  }
  return ''
}

function hasGlobalFlag(expression: ts.Expression): boolean {
  const object = unwrapObject(expression)
  if (object === undefined) return false

  return object.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyName(property.name) === '__global' &&
      unwrapExpression(property.initializer).kind === ts.SyntaxKind.TrueKeyword,
  )
}

function unwrapObject(expression: ts.Expression): ts.ObjectLiteralExpression | undefined {
  const value = unwrapExpression(expression)
  if (ts.isObjectLiteralExpression(value)) return value
  if (!ts.isCallExpression(value)) return undefined

  const [argument] = value.arguments
  if (argument === undefined) return undefined
  const object = unwrapExpression(argument)
  return ts.isObjectLiteralExpression(object) ? object : undefined
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}
