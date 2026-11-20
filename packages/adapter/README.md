# @monocon/adapter

Platform adapters for monocon. A single package exposing start functions for Node, Bun, Deno and Cloudflare Workers, each as a subpath export.

```ts
import { start } from '@monocon/adapter/node'

import middlewares from './middlewares/index.ts'
import routes from './routes/index.ts'

await start({ routes, middlewares, port: 3000 })
```

Each adapter shares the same `start(options?)` signature. Routes, middlewares and `port` are supplied by the caller; the adapter builds a fetch handler from them and hands it to the platform's `listen`. It never reads generated files or configuration files.
