# @monocon/adapter

Platform adapters for monocon. A single package exposing start functions for Node, Bun, Deno and Cloudflare Workers, each as a subpath export.

```ts
import { start } from '@monocon/adapter/node'

await start()
```

Each adapter shares the same `start(options?)` signature. It discovers configuration, imports the generated registry, builds the fetch handler and hands it to the platform's `listen`.
