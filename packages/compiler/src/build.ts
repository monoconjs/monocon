import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

import * as ts from 'typescript'

import type { Declaration } from './analyze.ts'
import { analyzeEntries } from './analyze.ts'
import { expandEntries, loadConfig } from './config.ts'
import { generate } from './generate.ts'

export interface BuildOptions {
  readonly cwd: string
  readonly config: string
}

export interface BuildResult {
  readonly outDir: string
  readonly entry: string
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const { cwd } = options

  await generate(cwd, options.config)

  const config = await loadConfig(resolve(cwd, options.config))
  const entryFiles = await expandEntries(config.entry)
  const { declarations } = await analyzeEntries(entryFiles)

  const roots = entryFiles

  const outDir = config.outDir
  const rootDir = commonDir(roots)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  compile(roots, rootDir, outDir, resolve(cwd, '.monocon/types.d.ts'))

  const registry = renderRegistry(rootDir, declarations)
  await writeFile(resolve(outDir, '__registry.mjs'), registry)

  const compiledPaths = roots.map((root) => compiledPathFor(root, rootDir, outDir))
  const texts = await Promise.all(compiledPaths.map((path) => readFile(path, 'utf8')))

  const writes: Array<{ path: string; text: string }> = []
  for (let index = 0; index < compiledPaths.length; index++) {
    const path = compiledPaths[index]!
    const transformed = injectRegistry(texts[index]!, {
      file: path,
      outDir,
    })
    if (transformed !== undefined) writes.push({ path, text: transformed })
  }
  await Promise.all(writes.map((write) => writeFile(write.path, write.text)))

  const entry = writes[0]?.path
  if (entry === undefined) {
    throw new Error('No start() call found in the compiled entry files')
  }

  return { outDir, entry }
}

interface InjectContext {
  readonly file: string
  readonly outDir: string
}

function injectRegistry(text: string, context: InjectContext): string | undefined {
  const { file, outDir } = context
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const startNames = importedStartNames(source)
  if (startNames.size === 0) return undefined

  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      startNames.has(node.expression.text)
    ) {
      calls.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (calls.length === 0) return undefined

  const registryImport = `import * as __monoconRegistry from '${importPath(file, resolve(outDir, '__registry.mjs'))}'`

  const replacements = calls.map((call) => {
    const callName = call.expression.getText(source)
    const [argument] = call.arguments
    const injected = (options?: string) =>
      `${callName}({ registry: __monoconRegistry${options === undefined ? '' : `, ...${options}`} })`
    if (
      argument === undefined ||
      (ts.isObjectLiteralExpression(argument) && argument.properties.length === 0)
    ) {
      return { start: call.getStart(source), end: call.getEnd(), text: injected() }
    }

    const userOptions = text.slice(argument.getStart(source), argument.getEnd())
    return {
      start: call.getStart(source),
      end: call.getEnd(),
      text: injected(userOptions),
    }
  })

  let output = text
  for (const item of replacements.toSorted((a, b) => b.start - a.start)) {
    output = output.slice(0, item.start) + item.text + output.slice(item.end)
  }

  return `${registryImport}\n${output}`
}

function importedStartNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!isStartModule(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.propertyName?.text === 'start' || element.name.text === 'start') {
        names.add(element.name.text)
      }
    }
  }
  return names
}

function isStartModule(specifier: string): boolean {
  return (
    /^monocon\/[^/]+$/.test(specifier) ||
    /^@monocon\/adapter\/[^/]+$/.test(specifier) ||
    specifier === '@monocon/adapter'
  )
}

function compiledPathFor(file: string, rootDir: string, outDir: string): string {
  const path = relative(rootDir, file).replace(/\.(ts|mts|cts|tsx)$/, '.js')
  return resolve(outDir, path)
}

function importPath(from: string, to: string): string {
  const path = relative(dirname(from), to).split(sep).join('/')
  return path.startsWith('.') ? path : `./${path}`
}

function compile(rootNames: string[], rootDir: string, outDir: string, typesFile: string): void {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: false,
    declaration: false,
    allowImportingTsExtensions: false,
    rewriteRelativeImportExtensions: true,
    outDir,
    rootDir,
    skipLibCheck: true,
    strict: true,
    esModuleInterop: true,
    types: ['node'],
  }

  const program = ts.createProgram([...rootNames, typesFile], options)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length > 0) {
    const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    })
    throw new Error(`Build failed:\n${message}`)
  }

  const emitted = program.emit()
  if (emitted.emitSkipped) throw new Error('Build failed: emit was skipped')
}

function renderRegistry(rootDir: string, declarations: Declaration[]): string {
  const files = [...new Set(declarations.map((declaration) => declaration.file))]

  const lines = [
    '// Generated by monocon. Do not edit.',
    '/* eslint-disable */',
    '/* oxlint-disable */',
    '/* prettier-ignore */',
    '',
  ]

  for (const file of files) lines.push(`export * from '${compiledSpecifier(rootDir, file)}'`)

  lines.push('')
  return lines.join('\n')
}

function compiledSpecifier(rootDir: string, file: string): string {
  const path = relative(rootDir, file).split(sep).join('/')
  return `./${path.replace(/\.(ts|mts|cts|tsx)$/, '.js')}`
}

function commonDir(files: string[]): string {
  if (files.length === 0) return process.cwd()

  const parts = files.map((file) => dirname(file).split(sep))
  const common: string[] = []
  for (let index = 0; index < parts[0]!.length; index++) {
    const part = parts[0]![index]
    if (part !== undefined && parts.every((segments) => segments[index] === part)) common.push(part)
    else break
  }
  return common.length > 0 ? common.join(sep) : sep
}
