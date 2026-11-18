# @monocon/core

Platform-neutral core runtime for monocon. Exposes a `(Request) => Promise<Response>` handler plus the `Adapter` contract, with no `node:` dependencies, so it can run on Node, Workers, or any Web-standard runtime.

```ts
import { createFetchHandler, createMatcher, collectDeclarations } from '@monocon/core'
```

For most applications, use `monocon` instead — it re-exports this runtime and provides the `bootstrap()` entry with a Node adapter.
