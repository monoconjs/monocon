import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import type { Adapter, RunningServer } from './contracts.ts'
import { createStart } from './shared/start.ts'

export type { Adapter, RunningServer, ServerConfig } from './contracts.ts'
export type { Start, StartOptions } from './shared/start.ts'

export const nodeAdapter: Adapter = {
  listen(config, handler) {
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

    return new Promise<RunningServer>((resolveListen, rejectListen) => {
      server.once('error', rejectListen)
      const done = () => {
        server.off('error', rejectListen)
        resolveListen({
          config,
          close: () =>
            new Promise<void>((resolveClose, rejectClose) => {
              server.close((error) => (error ? rejectClose(error) : resolveClose()))
            }),
        })
      }
      if (config.hostname === undefined) server.listen(config.port, done)
      else server.listen(config.port, config.hostname, done)
    })
  },
}

export const start = createStart(nodeAdapter)

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
