import { access } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { notFoundEndpoint } from './_not-found.ts'
import type { RuntimeEndpoint } from './endpoint.ts'
import { assignErrorName, isErrorFactory } from './errors/index.ts'
import { execute } from './execute.ts'
import { createMatcher, type Matcher } from './matcher.ts'
import type { RuntimeMiddleware } from './middleware.ts'

export interface ServerConfig {
  readonly port?: number
  readonly hostname?: string
}

export interface BootstrapOptions extends ServerConfig {
  readonly cwd?: string
  readonly configFile?: string
}

interface BootstrapInput extends BootstrapOptions {
  readonly registry?: object
}

export interface RunningServer {
  readonly close: () => Promise<void>
  readonly config: ServerConfig
}

export interface CollectedDeclarations {
  readonly endpoints: RuntimeEndpoint[]
  readonly middlewares: RuntimeMiddleware[]
}

export function collectDeclarations(registry: object): CollectedDeclarations {
  const endpoints: RuntimeEndpoint[] = []
  const middlewares: RuntimeMiddleware[] = []

  for (const [exportName, value] of Object.entries(registry)) {
    if (isErrorFactory(value)) assignErrorName(value, exportName)
    else if (isEndpoint(value)) endpoints.push(value)
    else if (isMiddleware(value)) middlewares.push(value)
  }

  return { endpoints, middlewares }
}

export function createFetchHandler(
  matcher: Matcher,
  middlewares: readonly RuntimeMiddleware[],
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url)
    const matched = matcher.match(request.method, url.pathname)
    const endpoint = matched ?? notFoundEndpoint(url.pathname)

    return execute(endpoint, request, {
      middlewares: [...middlewares],
      skipBody: matched === undefined,
    })
  }
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<RunningServer> {
  const opts: BootstrapInput = options
  const cwd = opts.cwd ?? process.cwd()
  const configFile = opts.configFile ?? 'configuration.ts'

  const loaded = await loadRuntimeConfig(configCandidates(cwd, configFile))
  const registry = opts.registry ?? (await importRegistry(resolve(cwd, '.monocon/registry.mjs')))

  return start(loaded, registry, opts)
}

async function start(
  loaded: LoadedConfig,
  registry: object,
  options: BootstrapOptions,
): Promise<RunningServer> {
  const fileConfig = loaded.config
  const config: ServerConfig = {
    port: options.port ?? fileConfig.port ?? 3000,
    hostname: options.hostname ?? fileConfig.hostname,
  }

  const { endpoints, middlewares } = collectDeclarations(registry)
  const handler = createFetchHandler(createMatcher(endpoints), middlewares)

  const server = createServer((req, res) => {
    void toWebRequest(req)
      .then(handler)
      .then((response) => sendResponse(res, response))
      .catch((error) => {
        if (!res.headersSent) res.writeHead(500)
        console.error(error)
        res.end('Internal Server Error')
      })
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    const done = () => {
      server.off('error', rejectListen)
      if (loaded.path) console.log(`Loaded config: ${loaded.path}`)
      resolveListen()
    }
    if (config.hostname === undefined) server.listen(config.port, done)
    else server.listen(config.port, config.hostname, done)
  })

  return {
    config,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      }),
  }
}

interface LoadedConfig {
  readonly config: ServerConfig
  readonly path: string | undefined
}

const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

function configCandidates(cwd: string, configFile: string): string[] {
  const matched = CONFIG_EXTENSIONS.find((extension) => configFile.endsWith(extension))
  const stem = matched ? configFile.slice(0, -matched.length) : configFile
  const names = [
    configFile,
    ...CONFIG_EXTENSIONS.filter((extension) => extension !== matched).map(
      (extension) => `${stem}${extension}`,
    ),
  ]

  return [cwd, resolve(cwd, 'src')].flatMap((dir) => names.map((name) => resolve(dir, name)))
}

async function loadRuntimeConfig(paths: string[]): Promise<LoadedConfig> {
  const candidates = await Promise.all(
    paths.map(async (path) => ({
      path,
      exists: await access(path).then(
        () => true,
        () => false,
      ),
    })),
  )
  const found = candidates.find((candidate) => candidate.exists)
  if (!found) return { config: {}, path: undefined }

  const module = await import(pathToFileURL(found.path).href)
  const value = module.default ?? module
  return { config: isServerConfig(value) ? value : {}, path: found.path }
}

async function importRegistry(path: string): Promise<object> {
  return import(pathToFileURL(path).href).catch(() => {
    throw new Error(`Registry not found at ${path}. Run 'monocon gen' first.`)
  })
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  const method = req.method ?? 'GET'
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else {
      headers.set(name, value)
    }
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  return new Request(url, { method, headers, body })
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', rejectBody)
  })
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  for (const [name, value] of response.headers) res.setHeader(name, value)
  res.end(Buffer.from(await response.arrayBuffer()))
}

function isEndpoint(value: unknown): value is RuntimeEndpoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~method' in value &&
    '~path' in value &&
    '~hooks' in value &&
    '~handler' in value
  )
}

function isMiddleware(value: unknown): value is RuntimeMiddleware {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~pattern' in value &&
    '~hooks' in value &&
    !('~path' in value)
  )
}

function isServerConfig(value: unknown): value is ServerConfig {
  return typeof value === 'object' && value !== null
}
