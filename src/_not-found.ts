import type { RuntimeEndpoint } from './endpoint.ts'

const NOT_FOUND_HOOKS: RuntimeEndpoint['~hooks'] = {
  onRequest: [],
  beforeHandle: [],
  afterHandle: [],
  onResponse: [],
  onError: [],
}

export function notFoundEndpoint(path: string): RuntimeEndpoint {
  return {
    '~method': 'ALL',
    '~path': path,
    '~options': {},
    '~provided': {},
    '~handler': () => new Response('Not Found', { status: 404 }),
    '~hooks': NOT_FOUND_HOOKS,
  }
}
