import { resolve } from 'node:path'

import { cac } from 'cac'
import { execa } from 'execa'

import { build } from './build.ts'
import { generate } from './generate.ts'

interface GenOptions {
  cwd?: string
  config?: string
}

export async function run(argv: string[]): Promise<void> {
  const cli = cac('monocon')
  const index = argv.indexOf('gen')
  const buildIndex = argv.indexOf('build')
  const passthrough = index === -1 ? [] : argv.slice(index + 1)
  const head = index === -1 ? [] : argv.slice(0, index)

  cli
    .command('gen', 'Generate .monocon declarations, then run a command')
    .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
    .option('--config <file>', 'Config file', { default: 'monocon.config.ts' })
    .action(async (options: GenOptions) => {
      await runGen(
        resolve(options.cwd ?? process.cwd()),
        options.config ?? 'monocon.config.ts',
        passthrough,
      )
    })

  cli
    .command('build', 'Compile source to .monocon-dist for bundlers')
    .option('--cwd <dir>', 'Working directory', { default: process.cwd() })
    .option('--config <file>', 'Config file', { default: 'monocon.config.ts' })
    .action(async (options: GenOptions) => {
      const result = await build({
        cwd: resolve(options.cwd ?? process.cwd()),
        config: options.config ?? 'monocon.config.ts',
      })
      console.log(`[monocon] Built ${result.outDir}`)
    })

  cli.help()

  if (index === -1 && buildIndex === -1) {
    cli.outputHelp()
    return
  }

  if (buildIndex !== -1 && (index === -1 || buildIndex < index)) {
    cli.parse(['node', 'monocon', 'build', ...argv.slice(buildIndex + 1)])
  } else {
    cli.parse(['node', 'monocon', ...head, 'gen'])
  }
}

async function runGen(cwd: string, config: string, passthrough: string[]): Promise<void> {
  const generated = await generate(cwd, config)

  for (const warning of generated.warnings) console.warn(`[monocon] warning: ${warning}`)

  const endpoints = generated.declarations.filter((item) => item.kind === 'endpoint').length
  const middlewares = generated.declarations.filter((item) => item.kind === 'middleware').length
  const errors = generated.declarations.filter((item) => item.kind === 'error').length
  console.log(
    `[monocon] Generated .monocon from ${endpoints} endpoint(s), ${middlewares} middleware(s) and ${errors} error(s)`,
  )

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
