import { defineTsdown } from '@monocon/config'

export default defineTsdown({
  entry: ['./src/index.ts', './src/globals.ts', './src/node.ts', './src/bun.ts'],
  outExtensions: () => ({
    js: '.js',
    dts: '.d.ts',
  }),
})
