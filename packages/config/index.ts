import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mergeConfig as mergeTsdownConfig, type UserConfig as TsdownConfig } from 'tsdown'
import { mergeConfig, type ViteUserConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('../..', import.meta.url))

function createFormatHook(outDir: string) {
  return () => {
    const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.[cm]?[jt]s$/.test(file))
      .map((file) => join(outDir, file))

    if (files.length === 0) return

    execSync(
      `oxfmt --write --config "${resolve(rootDir, '.oxfmtrc.dist.json')}" ${files.join(' ')}`,
      { stdio: 'inherit' },
    )
  }
}

export function defineTsdown(config: TsdownConfig = {}): TsdownConfig {
  const outDir = config.outDir ?? 'dist'

  return mergeTsdownConfig(
    {
      entry: ['src/index.ts'],
      outDir,
      format: ['esm', 'cjs'],
      platform: 'node',
      target: 'es2023',
      fixedExtension: true,
      dts: true,
      clean: true,
      hooks: {
        'build:done': createFormatHook(outDir),
      },
    },
    config,
  )
}

export function defineVitest(config: ViteUserConfig = {}): ViteUserConfig {
  return mergeConfig(
    {
      resolve: {
        alias: {
          '@monocon/core': resolve(rootDir, 'packages/core/src/index.ts'),
          '@monocon/adapter/node': resolve(rootDir, 'packages/adapter/src/node.ts'),
          '@monocon/adapter/bun': resolve(rootDir, 'packages/adapter/src/bun.ts'),
          '@monocon/adapter': resolve(rootDir, 'packages/adapter/src/index.ts'),
        },
      },
      test: {
        globals: true,
        environment: 'node',
        include: ['**/__test__/**/*.test.ts'],
        typecheck: {
          enabled: true,
          include: ['**/__test__/**/*.test-d.ts'],
        },
        coverage: {
          provider: 'v8',
          exclude: ['src/index.ts'],
        },
      },
    },
    config,
  )
}
