import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'

import * as ts from 'typescript'

const ROUTE_FACTORIES = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'del',
  'head',
  'options',
  'all',
])

const METHOD_NAMES: Record<string, string> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  del: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
  all: 'ALL',
}

export type Pattern =
  | { readonly kind: 'glob'; readonly value: string }
  | { readonly kind: 'rules'; readonly include: string[]; readonly exclude: string[] }

export interface RouteDecl {
  readonly kind: 'route'
  readonly file: string
  readonly exportName: string
  readonly method: string
  readonly path: string
  readonly default?: true
}

export interface MiddlewareDecl {
  readonly kind: 'middleware'
  readonly file: string
  readonly exportName: string
  readonly pattern: Pattern
  readonly default?: true
}

export interface ErrorDecl {
  readonly kind: 'error'
  readonly file: string
  readonly exportName: string
  readonly name: string | undefined
  readonly default?: true
}

export type Declaration = RouteDecl | MiddlewareDecl | ErrorDecl

export interface AnalyzeResult {
  readonly declarations: Declaration[]
  readonly warnings: string[]
}

export async function analyzeEntries(entryFiles: string[]): Promise<AnalyzeResult> {
  const warnings: string[] = []
  const declarations: Declaration[] = []
  let defaultIndex = 0
  const nextDefaultName = (): string => `__default_${defaultIndex++}`

  const sources = await Promise.all(
    entryFiles.map(async (file) => ({
      file,
      text: await readFile(file, 'utf8').catch(() => {
        throw new Error(`Could not read entry: ${file}`)
      }),
    })),
  )

  for (const { file, text } of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)

    const bindings = collectExports(source, nextDefaultName)
    const initializers = collectInitializers(source)
    for (const binding of bindings) {
      if (binding.inlineInitializer) initializers.set(binding.localName, binding.inlineInitializer)
    }

    for (const binding of bindings) {
      const initializer = initializers.get(binding.localName)
      if (!initializer) continue

      const factory = findFactoryCall(initializer)
      if (!factory) continue

      const defaultFlag = binding.isDefault ? { default: true as const } : {}

      if (factory.name === 'defineMiddleware') {
        const pattern = readPattern(factory.call, file, warnings)
        if (!pattern) continue

        declarations.push({
          kind: 'middleware',
          file,
          exportName: binding.exportName,
          pattern,
          ...defaultFlag,
        })
        continue
      }

      if (factory.name === 'defineError') {
        declarations.push({
          kind: 'error',
          file,
          exportName: binding.exportName,
          name: readErrorName(factory.call, file, warnings),
          ...defaultFlag,
        })
        continue
      }

      if (ROUTE_FACTORIES.has(factory.name)) {
        const path = readPath(factory.call, file, warnings)
        if (!path) continue
        declarations.push({
          kind: 'route',
          file,
          exportName: binding.exportName,
          method: METHOD_NAMES[factory.name] ?? factory.name.toUpperCase(),
          path,
          ...defaultFlag,
        })
      }
    }
  }

  return { declarations, warnings }
}

interface FactoryCall {
  readonly name: string
  readonly call: ts.CallExpression
}

function findFactoryCall(expression: ts.Expression): FactoryCall | undefined {
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression
    if (ts.isIdentifier(callee) && isFactoryName(callee.text)) {
      return { name: callee.text, call: expression }
    }
    if (ts.isPropertyAccessExpression(callee)) return findFactoryCall(callee.expression)
    if (ts.isCallExpression(callee)) return findFactoryCall(callee)
  }
  if (ts.isPropertyAccessExpression(expression)) return findFactoryCall(expression.expression)
  if (ts.isParenthesizedExpression(expression)) return findFactoryCall(expression.expression)
  return undefined
}

function isFactoryName(name: string): boolean {
  return name === 'defineMiddleware' || name === 'defineError' || ROUTE_FACTORIES.has(name)
}

function readPath(call: ts.CallExpression, file: string, warnings: string[]): string | undefined {
  const [argument] = call.arguments
  if (argument && ts.isStringLiteral(argument)) return argument.text

  warnings.push(`route path in ${relative(process.cwd(), file)} must be a string literal`)
  return undefined
}

function readErrorName(
  call: ts.CallExpression,
  file: string,
  warnings: string[],
): string | undefined {
  const [argument] = call.arguments
  if (!argument || !ts.isObjectLiteralExpression(argument)) return undefined

  const property = argument.properties.find(
    (item) => ts.isPropertyAssignment(item) && propertyName(item.name) === 'name',
  )
  if (!property || !ts.isPropertyAssignment(property)) return undefined

  if (ts.isStringLiteral(property.initializer)) return property.initializer.text

  warnings.push(`error name in ${relative(process.cwd(), file)} must be a string literal`)
  return undefined
}

function readPattern(
  call: ts.CallExpression,
  file: string,
  warnings: string[],
): Pattern | undefined {
  // defineMiddleware(hooks, pattern) — the pattern is the second argument.
  const argument = call.arguments[1]

  if (argument && ts.isStringLiteral(argument)) {
    return { kind: 'glob', value: argument.text }
  }

  if (argument && ts.isObjectLiteralExpression(argument)) {
    const include = readStringArray(argument, 'include')
    if (!include) {
      warnings.push(`middleware include in ${relative(process.cwd(), file)} must be a string array`)
      return undefined
    }
    const exclude = readStringArray(argument, 'exclude') ?? []
    return { kind: 'rules', include, exclude }
  }

  warnings.push(
    `middleware pattern in ${relative(process.cwd(), file)} must be a string literal or an object literal`,
  )
  return undefined
}

function readStringArray(object: ts.ObjectLiteralExpression, name: string): string[] | undefined {
  const property = object.properties.find(
    (item) => ts.isPropertyAssignment(item) && propertyName(item.name) === name,
  )
  if (
    !property ||
    !ts.isPropertyAssignment(property) ||
    !ts.isArrayLiteralExpression(property.initializer)
  ) {
    return undefined
  }

  const values: string[] = []
  for (const element of property.initializer.elements) {
    if (!ts.isStringLiteral(element)) return undefined
    values.push(element.text)
  }
  return values
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return undefined
}

interface ExportBinding {
  readonly localName: string
  readonly exportName: string
  readonly isDefault?: boolean
  readonly inlineInitializer?: ts.Expression
}

function collectExports(source: ts.SourceFile, nextDefaultName: () => string): ExportBinding[] {
  const bindings: ExportBinding[] = []

  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && hasExport(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          bindings.push({ localName: declaration.name.text, exportName: declaration.name.text })
        }
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const local = (element.propertyName ?? element.name).text
        const exported = element.name.text
        if (exported === 'default') {
          bindings.push({ localName: local, exportName: nextDefaultName(), isDefault: true })
        } else {
          bindings.push({ localName: local, exportName: exported })
        }
      }
    }

    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expression = statement.expression
      const exportName = nextDefaultName()
      if (ts.isIdentifier(expression)) {
        bindings.push({
          localName: expression.text,
          exportName,
          isDefault: true,
        })
      } else {
        bindings.push({
          localName: exportName,
          exportName,
          isDefault: true,
          inlineInitializer: expression,
        })
      }
    }
  }

  return bindings
}

function collectInitializers(source: ts.SourceFile): Map<string, ts.Expression> {
  const map = new Map<string, ts.Expression>()

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      map.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  return map
}

function hasExport(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return Boolean(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
}
