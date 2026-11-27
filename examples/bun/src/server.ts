import { app } from 'monocon/app'
import { serve } from 'monocon/bun'

const port = 3000
serve(app, { port })

console.log(`monocon bun example listening on http://localhost:${port}`)
