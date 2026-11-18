export interface FetchHandler {
  (request: Request): Promise<Response>
}

export interface ServerConfig {
  readonly port?: number
  readonly hostname?: string
}

export interface RunningServer {
  readonly close: () => Promise<void>
  readonly config: ServerConfig
}

export interface Adapter {
  listen(config: ServerConfig, handler: FetchHandler): Promise<RunningServer>
}
