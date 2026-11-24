import type { RuntimeRoute } from './route.ts'

const NOT_FOUND_HOOKS: RuntimeRoute['~hooks'] = {
  onRequest: [],
  beforeHandle: [],
  afterHandle: [],
  onResponse: [],
  onError: [],
}

export function notFoundRoute(path: string): RuntimeRoute {
  return {
    '~method': 'ALL',
    '~path': path,
    '~options': {},
    '~provided': {},
    '~handler': () => new Response('Not Found', { status: 404 }),
    '~hooks': NOT_FOUND_HOOKS,
    '~validations': {
      onRequest: {},
      beforeHandle: {},
      handle: {},
    },
  }
}
