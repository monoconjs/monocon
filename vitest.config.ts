import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@monocon/core/global': resolve(__dirname, 'packages/core/src/global.ts'),
      '@monocon/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@monocon/adapter/node': resolve(__dirname, 'packages/adapter/src/node.ts'),
      '@monocon/adapter/bun': resolve(__dirname, 'packages/adapter/src/bun.ts'),
      '@monocon/adapter/deno': resolve(__dirname, 'packages/adapter/src/deno.ts'),
      '@monocon/adapter/workers': resolve(__dirname, 'packages/adapter/src/workers.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__test__/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['__test__/**/*.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      exclude: ['src/index.ts'],
    },
  },
})
