import { auth } from './auth.ts'
import { logger } from './logger.ts'

// The array order is the source of truth for middleware execution.
export default [logger, auth]
