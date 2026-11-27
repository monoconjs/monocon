import { app } from 'monocon/app'
import { serve } from 'monocon/node'

const port = 3000
const server = await serve(app, { port })

console.log(`monocon node example listening on http://localhost:${port}`)

process.on('SIGINT', () => server.close())
process.on('SIGTERM', () => server.close())
