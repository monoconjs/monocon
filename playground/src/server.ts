import { serve } from 'monocon/node'

import { app } from '../.monocon/app.ts'

const port = 3000
const server = await serve(app, { port })

console.log(`monocon playground listening on http://localhost:${port}`)

process.on('SIGINT', () => server.close())
process.on('SIGTERM', () => server.close())
