import type {
  EndpointBuilder,
  EndpointFactory,
  EndpointOptions,
  EndpointState,
} from './types/endpoint.ts'
import type { EndpointMethod } from './types/http.ts'

export type EndpointLifecycle = 'onRequest' | 'beforeHandle' | 'afterHandle' | 'onResponse'

type Hook = (...args: any[]) => any

export interface RuntimeEndpoint {
  '~method': EndpointMethod
  '~path': string
  '~options': EndpointOptions
  '~provided': object
  '~handler': Hook | undefined
  '~hooks': Record<EndpointLifecycle, Hook[]>
}

interface Builder extends RuntimeEndpoint {
  onRequest: (hook: Hook) => Builder
  beforeHandle: (hook: Hook) => Builder
  handle: (handler: Hook) => Builder
  afterHandle: (hook: Hook) => Builder
  onResponse: (hook: Hook) => Builder
}

function createBuilder<
  Method extends EndpointMethod,
  Path extends string,
  Options extends EndpointOptions,
>(
  method: Method,
  path: Path,
  options: EndpointOptions,
): EndpointBuilder<'onRequest', EndpointState<Method, Path, Options>> {
  const hooks: Record<EndpointLifecycle, Hook[]> = {
    onRequest: [],
    beforeHandle: [],
    afterHandle: [],
    onResponse: [],
  }

  const builder: Builder = {
    '~method': method,
    '~path': path,
    '~options': options,
    '~provided': {},
    '~handler': undefined,
    '~hooks': hooks,
    onRequest(hook) {
      hooks.onRequest.push(hook)
      return builder
    },
    beforeHandle(hook) {
      hooks.beforeHandle.push(hook)
      return builder
    },
    handle(handler) {
      builder['~handler'] = handler
      return builder
    },
    afterHandle(hook) {
      hooks.afterHandle.push(hook)
      return builder
    },
    onResponse(hook) {
      hooks.onResponse.push(hook)
      return builder
    },
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return builder as unknown as EndpointBuilder<'onRequest', EndpointState<Method, Path, Options>>
}

function createEndpointFactory<Method extends EndpointMethod>(
  method: Method,
): EndpointFactory<Method> {
  return <Path extends string, Options extends EndpointOptions = {}>(
    path: Path,
    options?: Options,
  ) => createBuilder<Method, Path, Options>(method, path, options ?? {})
}

export const get = createEndpointFactory('GET')
export const post = createEndpointFactory('POST')
export const put = createEndpointFactory('PUT')
export const patch = createEndpointFactory('PATCH')
export const del = createEndpointFactory('DELETE')
export const head = createEndpointFactory('HEAD')
export const options = createEndpointFactory('OPTIONS')
export const all = createEndpointFactory('ALL')

export { del as delete }
