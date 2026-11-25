#!/usr/bin/env node
import { build } from '@monocon/compiler'

const configPath = process.argv[2]

try {
  const result = await build(configPath)
  console.log(`generated ${result.files.length} files for ${result.moduleCount} modules`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
