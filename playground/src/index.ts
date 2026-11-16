import { bootstrap } from 'monocon'

const server = await bootstrap()

console.log(`listening on http://localhost:${server.config.port}`)
