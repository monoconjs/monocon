import type { Adapter, RunningServer, ServerConfig } from '../packages/adapter/src/contracts.ts'
import { createStart } from '../packages/adapter/src/shared/start.ts'
import type { FetchHandler } from '../packages/core/src/fetch-handler.ts'
import { defineMiddleware, get } from '../src/index.ts'

interface ListenCall {
  readonly config: ServerConfig
  readonly handler: FetchHandler
}

function mockAdapter(): { adapter: Adapter; calls: ListenCall[] } {
  const calls: ListenCall[] = []
  const adapter: Adapter = {
    async listen(config, handler) {
      calls.push({ config, handler })
      return { config, close: () => Promise.resolve() } satisfies RunningServer
    },
  }
  return { adapter, calls }
}

describe('start (explicit options)', () => {
  it('converts the routes object to an array and filters non-routes', async () => {
    const { adapter, calls } = mockAdapter()
    const start = createStart(adapter)
    const health = get('/health').handle(() => ({ ok: true }))

    await start({ routes: { health, version: '1.0.0' }, port: 4321 })

    const { handler, config } = calls[0]!
    expect(config.port).toBe(4321)
    expect((await handler(new Request('http://x/health'))).status).toBe(200)
    expect((await handler(new Request('http://x/version'))).status).toBe(404)
  })

  it('keeps middleware order', async () => {
    const { adapter, calls } = mockAdapter()
    const start = createStart(adapter)
    const order: string[] = []
    const first = defineMiddleware({
      onRequest: () => {
        order.push('first')
        return {}
      },
    })
    const second = defineMiddleware({
      onRequest: () => {
        order.push('second')
        return {}
      },
    })
    const health = get('/health').handle(() => ({ ok: true }))

    await start({ routes: { health }, middlewares: [first, second] })
    await calls[0]!.handler(new Request('http://x/health'))

    expect(order).toEqual(['first', 'second'])
  })

  it('defaults port to 3000 and does not read configuration or log', async () => {
    const { adapter, calls } = mockAdapter()
    const start = createStart(adapter)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const server = await start({})

    expect(server.config.port).toBe(3000)
    expect(calls[0]!.config.port).toBe(3000)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
