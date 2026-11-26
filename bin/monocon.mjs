#!/usr/bin/env node
import { relative, resolve } from 'node:path'
import { styleText } from 'node:util'

import { build, logger } from '@monocon/compiler'

const configPath = process.argv[2]
const start = performance.now()
const resolvedConfig = configPath ? resolve(configPath) : 'default'
const modulesMarker = '/modules/'

function formatFile(file, root) {
  const path = relative(root, file)
  const index = path.indexOf(modulesMarker)
  return index === -1
    ? path
    : path.slice(0, index + modulesMarker.length) +
        styleText('green', path.slice(index + modulesMarker.length))
}

logger.info(`config file: ${styleText('underline', resolvedConfig)}`)
logger.info('Build start')

try {
  const result = await build(configPath)
  const cwd = process.cwd()

  logger.info(`files: ${result.files.length}`)
  logger.info(`modules: ${result.moduleCount}`)
  for (const file of result.files) {
    logger.info(formatFile(file, cwd))
  }

  logger.success(`Build complete in ${Math.round(performance.now() - start)}ms`)
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
