import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'

import * as ts from 'typescript'

const ENDPOINT_FACTORIES = new Set([
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

export interface EndpointDecl {
  readonly kind: 'endpoint'
  readonly file: string
  readonly exportName: string
  readonly method: string
  readonly path: string
}

export interface MiddlewareDecl {
  readonly kind: 'middleware'
  readonly file: string
  readonly exportName: string
  readonly pattern: Pattern
}

export type Declaration = EndpointDecl | MiddlewareDecl

export interface AnalyzeResult {
  readonly declarations: Declaration[]
  readonly warnings: string[]
}

export async function analyzeEntries(entryFiles: string[]): Promise<AnalyzeResult> {
  const warnings: string[] = []
  const declarations: Declaration[] = []

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

    const bindings = collectExports(source)
    const initializers = collectInitializers(source)

    for (const binding of bindings) {
      const initializer = initializers.get(binding.localName)
      if (!initializer) continue

      const factory = findFactoryCall(initializer)
      if (!factory) continue

      if (factory.name === 'middleware') {
        const pattern = readPattern(factory.call, file, warnings)
        if (!pattern) continue

        declarations.push({
          kind: 'middleware',
          file,
          exportName: binding.exportName,
          pattern,
        })
        continue
      }

      if (ENDPOINT_FACTORIES.has(factory.name)) {
        const path = readPath(factory.call, file, warnings)
        if (!path) continue
        declarations.push({
          kind: 'endpoint',
          file,
          exportName: binding.exportName,
          method: METHOD_NAMES[factory.name] ?? factory.name.toUpperCase(),
          path,
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
  return name === 'middleware' || ENDPOINT_FACTORIES.has(name)
}

function readPath(call: ts.CallExpression, file: string, warnings: string[]): string | undefined {
  const [argument] = call.arguments
  if (argument && ts.isStringLiteral(argument)) return argument.text

  warnings.push(`endpoint path in ${relative(process.cwd(), file)} must be a string literal`)
  return undefined
}

function readPattern(
  call: ts.CallExpression,
  file: string,
  warnings: string[],
): Pattern | undefined {
  const [argument] = call.arguments

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
}

function collectExports(source: ts.SourceFile): ExportBinding[] {
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
        bindings.push({ localName: local, exportName: element.name.text })
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
