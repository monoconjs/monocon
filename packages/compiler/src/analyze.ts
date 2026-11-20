import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

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

function joinPath(prefix: string, path: string): string {
  const base = prefix === '/' ? '' : prefix.replace(/\/+$/, '')
  if (base === '') return path
  if (path === '/' || path === '') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
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

interface NamespaceImport {
  readonly local: string
  readonly target: string
}

/**
 * Reads the `export default [ ... ]` array of a scanned file and returns the
 * declaration names in source order. Elements may be:
 * - a plain identifier (`getUser`);
 * - a namespace-qualified access (`routes.getUser`);
 * - a whole namespace import (`routes` from `import * as routes from '...'`),
 *   which expands to every named export of the imported file. Order within
 *   an expanded namespace is irrelevant for routes (the matcher scores paths).
 */
export async function readOrderedNames(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8').catch(() => {
    throw new Error(`Could not read entry: ${file}`)
  })
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const namespaces = collectNamespaceImports(source, file)

  const assignment = source.statements.find(
    (statement): statement is ts.ExportAssignment & { expression: ts.ArrayLiteralExpression } =>
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      ts.isArrayLiteralExpression(statement.expression),
  )
  if (assignment === undefined) return []

  const elements = assignment.expression.elements
  const namespaceTargets = elements.map((element) => {
    if (!ts.isIdentifier(element)) return undefined
    return namespaces.find((item) => item.local === element.text)?.target
  })
  const expanded = await Promise.all(
    namespaceTargets.map((target) =>
      target === undefined ? Promise.resolve([] as string[]) : readNamedExports(target),
    ),
  )

  const names: string[] = []
  for (const [index, element] of elements.entries()) {
    const namespaceNames = expanded[index]
    if (namespaceNames !== undefined && namespaceTargets[index] !== undefined) {
      names.push(...namespaceNames)
      continue
    }
    const name = elementName(element)
    if (name !== undefined) names.push(name)
  }
  return names
}

function collectNamespaceImports(source: ts.SourceFile, file: string): NamespaceImport[] {
  const result: NamespaceImport[] = []
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause === undefined
    ) {
      continue
    }
    const bindings = statement.importClause.namedBindings
    if (bindings === undefined || !ts.isNamespaceImport(bindings)) continue
    result.push({
      local: bindings.name.text,
      target: resolveSourceFile(dirname(file), statement.moduleSpecifier.text),
    })
  }
  return result
}

function resolveSourceFile(fromDir: string, specifier: string): string {
  // Entry imports use .ts extensions; strip a leading ./ and resolve.
  const clean = specifier.startsWith('.') ? specifier : `./${specifier}`
  return resolve(fromDir, clean)
}

async function readNamedExports(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8').catch(() => '')
  if (text === '') return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const names: string[] = []
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && hasExport(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      }
    }
  }
  return names
}

function elementName(element: ts.Expression): string | undefined {
  if (ts.isIdentifier(element)) return element.text
  if (ts.isPropertyAccessExpression(element) && ts.isIdentifier(element.name)) {
    return element.name.text
  }
  return undefined
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
    const groups = collectGroups(source, file, warnings)
    for (const binding of bindings) {
      if (binding.inlineInitializer) initializers.set(binding.localName, binding.inlineInitializer)
    }

    for (const binding of bindings) {
      const initializer = initializers.get(binding.localName)
      if (!initializer) continue

      const factory = findFactoryCall(initializer, groups)
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
        if (path === undefined) continue
        declarations.push({
          kind: 'route',
          file,
          exportName: binding.exportName,
          method: METHOD_NAMES[factory.name] ?? factory.name.toUpperCase(),
          path: joinPath(factory.prefix, path),
          ...defaultFlag,
        })
      }
    }
  }

  return { declarations, warnings: [...new Set(warnings)] }
}

interface FactoryCall {
  readonly name: string
  readonly call: ts.CallExpression
  readonly prefix: string
}

interface GroupMethodBinding {
  readonly method: string
  readonly prefix: string
}

interface GroupInfo {
  readonly prefixes: Map<string, string>
  readonly methods: Map<string, GroupMethodBinding>
}

function findFactoryCall(expression: ts.Expression, groups: GroupInfo): FactoryCall | undefined {
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression
    if (ts.isIdentifier(callee)) {
      const binding = groups.methods.get(callee.text)
      if (binding !== undefined) {
        return { name: binding.method, call: expression, prefix: binding.prefix }
      }
      if (isFactoryName(callee.text)) {
        return { name: callee.text, call: expression, prefix: '' }
      }
    }
    if (ts.isPropertyAccessExpression(callee)) {
      if (ROUTE_FACTORIES.has(callee.name.text) && ts.isIdentifier(callee.expression)) {
        const prefix = groups.prefixes.get(callee.expression.text)
        if (prefix !== undefined) {
          return { name: callee.name.text, call: expression, prefix }
        }
      }
      return findFactoryCall(callee.expression, groups)
    }
    if (ts.isCallExpression(callee)) return findFactoryCall(callee, groups)
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return findFactoryCall(expression.expression, groups)
  }
  if (ts.isParenthesizedExpression(expression)) {
    return findFactoryCall(expression.expression, groups)
  }
  return undefined
}

function collectGroups(source: ts.SourceFile, file: string, warnings: string[]): GroupInfo {
  const prefixes = new Map<string, string>()
  const methods = new Map<string, GroupMethodBinding>()
  let changed = true

  while (changed) {
    changed = false
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer === undefined) continue
        const prefix = groupPrefix(declaration.initializer, prefixes, file, warnings)
        if (prefix === undefined) continue

        if (ts.isIdentifier(declaration.name)) {
          if (prefixes.get(declaration.name.text) === prefix) continue
          prefixes.set(declaration.name.text, prefix)
          changed = true
          continue
        }

        if (!ts.isObjectBindingPattern(declaration.name)) continue
        for (const element of declaration.name.elements) {
          if (ts.isOmittedExpression(element) || !ts.isIdentifier(element.name)) continue
          const method = element.propertyName
            ? propertyName(element.propertyName)
            : element.name.text
          if (method === undefined || !ROUTE_FACTORIES.has(method)) continue

          const local = element.name.text
          const binding = { method, prefix }
          const existing = methods.get(local)
          if (existing?.method === binding.method && existing.prefix === binding.prefix) continue
          methods.set(local, binding)
          changed = true
        }
      }
    }
  }

  return { prefixes, methods }
}

function groupPrefix(
  expression: ts.Expression,
  prefixes: ReadonlyMap<string, string>,
  file: string,
  warnings: string[],
): string | undefined {
  if (ts.isIdentifier(expression)) return prefixes.get(expression.text)
  return readGroupPrefix(expression, prefixes, file, warnings)
}

function readGroupPrefix(
  expression: ts.Expression,
  groups: ReadonlyMap<string, string>,
  file: string,
  warnings: string[],
): string | undefined {
  if (!ts.isCallExpression(expression)) return undefined

  const callee = expression.expression
  let parent: string | undefined
  if (ts.isIdentifier(callee)) {
    if (callee.text !== 'defineGroup') return undefined
    parent = ''
  } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'group') {
    if (ts.isIdentifier(callee.expression)) {
      parent = groups.get(callee.expression.text)
    } else {
      parent = readGroupPrefix(callee.expression, groups, file, warnings)
    }
  } else {
    return undefined
  }

  if (parent === undefined) return undefined
  const [argument] = expression.arguments
  if (!argument || !ts.isStringLiteral(argument)) {
    warnings.push(`group prefix in ${relative(process.cwd(), file)} must be a string literal`)
    return undefined
  }
  return joinPath(parent, argument.text)
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
