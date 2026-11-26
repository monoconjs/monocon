import { formatWithOptions, styleText } from 'node:util'

import { createConsola, type ConsolaReporter, type LogType } from 'consola'

export type TagStyle = Parameters<typeof styleText>[0]

const TYPE_FORMAT: Partial<Record<LogType, { icon: string; color: TagStyle }>> = {
  info: { icon: 'ℹ', color: 'blue' },
  success: { icon: '✔', color: 'green' },
  warn: { icon: '⚠', color: 'yellow' },
  debug: { icon: '›', color: 'gray' },
  error: { icon: '✖', color: 'red' },
  fatal: { icon: '✖', color: 'red' },
}

function createReporter(tagStyle: TagStyle): ConsolaReporter {
  return {
    log(logObj, { options }) {
      const stream =
        logObj.level < 2 ? (options.stderr ?? process.stderr) : (options.stdout ?? process.stdout)
      const message = formatWithOptions(options.formatOptions, ...logObj.args)
      const tag = styleText(logObj.level < 2 ? 'red' : tagStyle, '[monocon]')
      const format = TYPE_FORMAT[logObj.type] ?? { icon: 'ℹ', color: 'blue' as TagStyle }
      stream.write(`${tag} ${styleText(format.color, format.icon)} ${message}\n`)
    },
  }
}

export function createLogger(tagStyle: TagStyle = 'cyan') {
  return createConsola({ reporters: [createReporter(tagStyle)] })
}

export const logger = createLogger()
