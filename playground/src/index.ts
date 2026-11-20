import { start } from 'monocon/node'

import middlewares from './middlewares/index.ts'
import * as routes from './routes/index.ts'

const server = await start({ routes, middlewares, port: 3030 })

console.log(`listening on http://localhost:${server.config.port}`)
