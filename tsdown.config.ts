import { defineTsdown } from '@monocon/config'

export default defineTsdown({
  entry: ['./src/index.ts', './src/globals.ts'],
  outExtensions: () => ({
    js: '.js',
    dts: '.d.ts',
  }),
})
