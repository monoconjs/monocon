#!/usr/bin/env node

import { run } from '@monocon/compiler/cli'

run(process.argv.slice(2)).catch((error) => {
  console.error(`[monocon] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
