import { start as bootstrap } from 'monocon/node'

const server = await bootstrap()

console.log(`listening on http://localhost:${server.config.port}`)
