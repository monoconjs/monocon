import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import * as ts from 'typescript'

import { expandEntries, loadConfig } from './config.ts'
import { generate } from './generate.ts'

export interface BuildOptions {
  readonly cwd: string
  readonly config: string
}

export interface BuildResult {
  readonly outDir: string
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const { cwd } = options

  const generated = await generate(cwd, options.config)

  const config = await loadConfig(resolve(cwd, options.config))
  const roots = await expandEntries(config.entry)

  const outDir = config.outDir
  const rootDir = commonDir(roots)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  compile(
    roots,
    rootDir,
    outDir,
    generated.files.map((file) => file.path),
  )

  return { outDir }
}

function compile(rootNames: string[], rootDir: string, outDir: string, typesFiles: string[]): void {
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

  const program = ts.createProgram([...rootNames, ...typesFiles], options)
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
