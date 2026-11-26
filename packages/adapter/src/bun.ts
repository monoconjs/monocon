import type { App } from '@monocon/core'

export interface ServeOptions {
  readonly hostname?: string
  readonly port?: number
}

export interface Server {
  stop(closeActiveConnections?: boolean): Promise<void>
}

interface BunServeOptions {
  readonly fetch: (request: Request) => Promise<Response>
  readonly hostname?: string
  readonly port?: number
}

interface BunServer {
  stop(closeActiveConnections?: boolean): Promise<void>
}

declare const Bun: {
  serve(options: BunServeOptions): BunServer
}

export function serve(app: App, options: ServeOptions = {}): Server {
  return Bun.serve({
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    port: options.port ?? 3000,
    fetch: (request) =>
      app.fetch(request).catch(
        () =>
          new Response('Internal Server Error', {
            status: 500,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          }),
      ),
  })
}
