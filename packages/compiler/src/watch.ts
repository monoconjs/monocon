import { basename, dirname, extname, resolve } from 'node:path'

import { watch as chokidarWatch } from 'chokidar'
import { execa, type ResultPromise } from 'execa'

import { expandEntries, loadConfig } from './config.ts'

const DEBOUNCE_MS = 120

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.json'])

const IGNORED_SEGMENTS = new Set([
  '.monocon',
  '.monocon-dist',
  'node_modules',
  '.git',
  'dist',
  'build',
])

export interface WatchHandle {
  readonly close: () => Promise<void>
}

export async function watch(
  cwd: string,
  configFile: string,
  regenerate: () => Promise<void>,
  command: string | undefined,
  args: string[],
): Promise<WatchHandle> {
  const configPath = resolve(cwd, configFile)
  const config = await loadConfig(configPath)
  const ignoredSegments = new Set([...IGNORED_SEGMENTS, basename(config.outDir)])
  const targets = await watchTargets(configPath, config.entry)

  let controller: AbortController | undefined
  let child: ResultPromise | undefined

  const startChild = (): void => {
    if (command === undefined) return
    controller = new AbortController()
    child = execa(command, args, {
      cwd,
      stdio: 'inherit',
      preferLocal: true,
      cancelSignal: controller.signal,
      reject: false,
    })
    void child.catch(() => {})
  }

  const stopChild = async (): Promise<void> => {
    const current = child
    const currentController = controller
    child = undefined
    controller = undefined
    if (current === undefined) return
    currentController?.abort()
    await current
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let queued = false
  let closed = false

  const runPass = async (): Promise<void> => {
    if (running) {
      queued = true
      return
    }

    running = true
    try {
      clearScreen()
      await stopChild()
      try {
        await regenerate()
      } catch (error) {
        console.error(`[monocon] watch: ${error instanceof Error ? error.message : String(error)}`)
      }
      if (!closed) startChild()
    } finally {
      running = false
      if (queued) {
        queued = false
        void runPass()
      }
    }
  }

  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void runPass()
    }, DEBOUNCE_MS)
  }

  const onChange = (path: string): void => {
    if (!isSource(path)) return
    schedule()
  }

  const watcher = chokidarWatch(targets, {
    ignoreInitial: true,
    atomic: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    ignored: (path, stats) => isIgnored(path, stats, ignoredSegments),
  })
  watcher.on('add', onChange)
  watcher.on('change', onChange)
  watcher.on('unlink', onChange)
  watcher.on('error', (error) => {
    console.error(`[monocon] watch: ${error instanceof Error ? error.message : String(error)}`)
  })

  startChild()

  return {
    close: async () => {
      if (closed) return
      closed = true
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      await watcher.close()
      await stopChild()
    },
  }
}

export async function watchTargets(configPath: string, entryPatterns: string[]): Promise<string[]> {
  const targets = new Set<string>([configPath])

  for (const pattern of entryPatterns) {
    targets.add(staticBase(pattern))
  }

  for (const file of await expandEntries(entryPatterns)) {
    targets.add(dirname(file))
  }

  return [...targets]
}

export function staticBase(pattern: string): string {
  const parts = pattern.replaceAll('\\', '/').split('/')
  const staticParts: string[] = []
  for (const part of parts) {
    if (/[*?[\]{}]/.test(part)) break
    staticParts.push(part)
  }

  let base = staticParts.join('/')
  if (base === '' || base === '/') base = pattern.startsWith('/') ? '/' : '.'
  if (extname(base) !== '') base = dirname(base)
  return base
}

export function clearScreen(): void {
  console.clear()
}

export interface DirectoryStat {
  readonly isDirectory: () => boolean
}

export function isIgnored(
  path: string,
  stats: DirectoryStat | undefined,
  ignoredSegments: ReadonlySet<string>,
): boolean {
  const normalized = path.replaceAll('\\', '/')
  if (normalized.split('/').some((segment) => ignoredSegments.has(segment.toLowerCase()))) {
    return true
  }
  return stats !== undefined && !stats.isDirectory() && !isSource(normalized)
}

export function isSource(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(path).toLowerCase())
}
