import { resolve } from 'node:path'

import { cac } from 'cac'
import { execa } from 'execa'

import { build } from './build.ts'
import { generate } from './generate.ts'
import { watch } from './watch.ts'

interface CommandOptions {
  cwd?: string
  config?: string
}

export interface SplitCommandArgs {
  readonly kind: 'gen' | 'build'
  readonly head: string[]
  readonly passthrough: string[]
  readonly watchMode: boolean
}

export function splitCommandArgs(argv: readonly string[]): SplitCommandArgs | undefined {
  const genIndex = argv.indexOf('gen')
  const buildIndex = argv.indexOf('build')
  if (genIndex === -1 && buildIndex === -1) return undefined

  const kind: 'gen' | 'build' =
    buildIndex !== -1 && (genIndex === -1 || buildIndex < genIndex) ? 'build' : 'gen'
  const index = kind === 'build' ? buildIndex : genIndex

  let head = argv.slice(0, index)
  let rest = argv.slice(index + 1)
  let watchMode = false

  if (kind === 'gen') {
    const watchInHead = head.indexOf('--watch')
    if (watchInHead !== -1) {
      watchMode = true
      head = head.filter((_, position) => position !== watchInHead)
    }
  }

  while (rest.length > 0) {
    const token = rest[0]!
    if (kind === 'gen' && token === '--watch') {
      watchMode = true
      rest = rest.slice(1)
      continue
    }
    if (token === '--cwd' || token === '--config') {
      if (rest[1] !== undefined) {
        head.push(token, rest[1])
        rest = rest.slice(2)
      } else {
        head.push(token)
        rest = rest.slice(1)
      }
      continue
    }
    if (token.startsWith('--cwd=') || token.startsWith('--config=')) {
      head.push(token)
      rest = rest.slice(1)
      continue
    }
    break
  }

  return { kind, head, passthrough: rest, watchMode }
}

export async function run(argv: string[]): Promise<void> {
  const cli = cac('monocon')
  const parsed = splitCommandArgs(argv)

  cli
    .command('gen', 'Generate .monocon declarations, then run a command')
    .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
    .option('--config <file>', 'Config file', { default: 'monocon.config.ts' })
    .option('--watch', 'Regenerate on source changes and restart the command')
    .action(async (options: CommandOptions) => {
      await runGen(
        resolve(options.cwd ?? process.cwd()),
        options.config ?? 'monocon.config.ts',
        parsed?.passthrough ?? [],
        parsed?.watchMode ?? false,
      )
    })

  cli
    .command('build', 'Compile source to .monocon-dist for bundlers, then run a command')
    .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
    .option('--config <file>', 'Config file', { default: 'monocon.config.ts' })
    .action(async (options: CommandOptions) => {
      const cwd = resolve(options.cwd ?? process.cwd())
      const result = await build({
        cwd,
        config: options.config ?? 'monocon.config.ts',
      })
      console.log(`[monocon] Built ${result.outDir}`)
      await runCommand(cwd, parsed?.passthrough ?? [])
    })

  cli.help()

  if (parsed === undefined) {
    cli.outputHelp()
    return
  }

  cli.parse(['node', 'monocon', ...parsed.head, parsed.kind])
}

async function runGen(
  cwd: string,
  config: string,
  passthrough: string[],
  watchMode: boolean,
): Promise<void> {
  if (watchMode) reportWatching()

  await generateAndReport(cwd, config)

  if (watchMode) {
    await runWatch(cwd, config, passthrough)
    return
  }

  await runCommand(cwd, passthrough)
}

async function runCommand(cwd: string, passthrough: string[]): Promise<void> {
  if (passthrough.length === 0) return

  const [command, ...args] = passthrough
  if (!command) return

  try {
    const child = await execa(command, args, {
      stdio: 'inherit',
      preferLocal: true,
      cwd,
      reject: false,
    })
    process.exitCode = child.exitCode ?? 0
  } catch (error) {
    console.error(`[monocon] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

async function generateAndReport(cwd: string, configFile: string): Promise<void> {
  const generated = await generate(cwd, configFile)

  for (const warning of generated.warnings) console.warn(`[monocon] warning: ${warning}`)

  const routes = generated.declarations.filter((item) => item.kind === 'route').length
  const middlewares = generated.declarations.filter((item) => item.kind === 'middleware').length
  const errors = generated.declarations.filter((item) => item.kind === 'error').length
  console.log(
    `[monocon] Generated .monocon from ${routes} route(s), ${middlewares} middleware(s) and ${errors} error(s)`,
  )
}

function reportWatching(): void {
  console.log('[monocon] Watching for changes. Press Ctrl+C to stop.')
}

async function runWatch(cwd: string, config: string, passthrough: string[]): Promise<void> {
  const [command, ...args] = passthrough
  const regenerate = async (): Promise<void> => {
    reportWatching()
    await generateAndReport(cwd, config)
  }
  const handle = await watch(cwd, config, regenerate, command, args)

  let stopping = false
  const shutdown = (): void => {
    if (stopping) {
      process.exit(1)
      return
    }
    stopping = true
    void handle
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error(`[monocon] ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
