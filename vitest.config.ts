import { resolve } from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@monocon/core': resolve(__dirname, 'packages/core/src/index.ts'),
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
})
