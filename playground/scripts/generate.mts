import { relative, resolve } from 'node:path'
import { styleText } from 'node:util'

import { build, logger } from '../../packages/compiler/src/index.ts'

const root = resolve(import.meta.dirname, '..')
const configPath = resolve(root, 'monocon.config.ts')
const start = performance.now()
const modulesMarker = '/modules/'

function formatFile(file: string) {
  const path = relative(root, file)
  const index = path.indexOf(modulesMarker)
  return index === -1
    ? path
    : path.slice(0, index + modulesMarker.length) +
        styleText('green', path.slice(index + modulesMarker.length))
}

logger.info(`config file: ${styleText('underline', configPath)}`)
logger.info('Build start')

try {
  const result = await build(configPath)

  logger.info(`files: ${result.files.length}`)
  logger.info(`modules: ${result.moduleCount}`)
  for (const file of result.files) {
    logger.info(formatFile(file))
  }

  logger.success(`Build complete in ${Math.round(performance.now() - start)}ms`)
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
