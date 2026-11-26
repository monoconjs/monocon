import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'

import type { App } from './app.ts'

export interface ServeOptions {
  readonly host?: string
  readonly port?: number
}

export function createServer(app: App): Server {
  return createHttpServer((request, response) => {
    void handleRequest(app, request, response)
  })
}

export async function serve(app: App, options: ServeOptions = {}): Promise<Server> {
  const server = createServer(app)
  const port = options.port ?? 3000

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, options.host, () => {
      server.off('error', reject)
      resolve()
    })
  })

  return server
}

async function handleRequest(
  app: App,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  try {
    const request = await toWebRequest(incoming)
    const response = await app.fetch(request)
    await writeResponse(outgoing, response)
  } catch {
    if (!outgoing.headersSent) {
      outgoing.statusCode = 500
      outgoing.setHeader('content-type', 'text/plain; charset=utf-8')
    }
    outgoing.end('Internal Server Error')
  }
}

async function toWebRequest(incoming: IncomingMessage): Promise<Request> {
  const host = incoming.headers.host ?? 'localhost'
  const url = new URL(incoming.url ?? '/', `http://${host}`)
  const method = incoming.method ?? 'GET'
  const headers = new Headers()

  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else {
      headers.set(name, value)
    }
  }

  const body =
    method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(await readChunks(incoming))

  return new Request(url, { method, headers, body })
}

function readChunks(incoming: IncomingMessage): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    incoming.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    incoming.on('end', () => resolve(chunks))
    incoming.on('error', reject)
  })
}

async function writeResponse(outgoing: ServerResponse, response: Response): Promise<void> {
  outgoing.statusCode = response.status
  response.headers.forEach((value, name) => outgoing.setHeader(name, value))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}
