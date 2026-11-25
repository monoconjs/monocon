import { resolve } from 'node:path'

import { build } from '../../packages/compiler/src/index.ts'

const result = await build(resolve(import.meta.dirname, '../monocon.config.ts'))

console.log(`generated ${result.moduleCount} module declarations`)
