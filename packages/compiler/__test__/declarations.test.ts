import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { build } from '../src/build.ts'

const corePath = fileURLToPath(new URL('../../core/src/index.ts', import.meta.url))

describe('generated declarations', () => {
  it('provides module-specific route methods in a TypeScript project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monocon-declarations-'))
    await writeFile(join(root, 'package.json'), '{"type":"module"}')
    await writeFile(join(root, 'monocon.config.ts'), `export default { entry: ['src/**/*.ts'] }\n`)
    await writeFile(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2023',
          lib: ['ES2023', 'DOM'],
          module: 'nodenext',
          moduleResolution: 'nodenext',
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          allowImportingTsExtensions: true,
          baseUrl: '.',
          paths: { '@monocon/core': [corePath] },
        },
        include: ['src', '.monocon/**/*'],
      }),
    )

    await mkdir(join(root, 'src/routes'), { recursive: true })
    await mkdir(join(root, 'src/middlewares'), { recursive: true })
    await writeFile(
      join(root, 'src/middlewares/auth.ts'),
      `export const auth = () => ({\n  beforeHandle: () => ({ user: 'admin' }),\n})\n`,
    )
    await writeFile(
      join(root, 'src/middlewares/global.ts'),
      `import { auth } from './auth.ts'\n\nexport const INJECTS = { __global: true, auth }\n`,
    )
    await writeFile(
      join(root, 'src/routes/users.ts'),
      `export const META = { prefix: '/api' } as const\nexport const INJECTS = {\n  local: { beforeHandle: () => ({ locale: 'en' }) },\n}\n\nexport const route = get('/users/:id', (ctx) => {\n  const user: string = ctx.user\n  const locale: string = ctx.locale\n  const id: string = ctx.params.id\n  return ctx.json({ user, locale, id })\n})\n`,
    )

    await build(join(root, 'monocon.config.ts'))

    const configFile = ts.readConfigFile(join(root, 'tsconfig.json'), (path) =>
      ts.sys.readFile(path),
    )
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
    const program = ts.createProgram(parsed.fileNames, parsed.options)
    const messages = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))

    expect(messages).toEqual([])
  })
})
