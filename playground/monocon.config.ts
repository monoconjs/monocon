import { defineConfig } from '@monocon/cli'

export default defineConfig({
  entry: ['src/**/*.ts'],
  build: {
    outDir: 'dist',
  },
})
