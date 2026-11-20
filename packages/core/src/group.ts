import { createRouteFactory, joinPath, mergeRouteOptions } from './route.ts'
import type {
  GroupRouteFactory,
  JoinPath,
  MergeGroupOptions,
  RouteGroup,
  WithMeta,
} from './types/group.ts'
import type { RouteMethod } from './types/http.ts'
import type { RouteMeta, RouteOptions } from './types/route.ts'

function withMeta(options: RouteOptions, meta: RouteMeta): RouteOptions {
  if (Object.keys(meta).length === 0 && options.meta === undefined) return options
  return { ...options, meta: { ...options.meta, ...meta } }
}

function createGroup<Prefix extends string, Options extends RouteOptions>(
  prefix: Prefix,
  options: Options,
): RouteGroup<Prefix, Options> {
  const factory = <Method extends RouteMethod>(
    method: Method,
  ): GroupRouteFactory<Method, Prefix, Options> => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return createRouteFactory(method, prefix, options) as unknown as GroupRouteFactory<
      Method,
      Prefix,
      Options
    >
  }

  const nestedGroup = <
    ChildPrefix extends string,
    ChildOptions extends RouteOptions = {},
    ChildMeta extends RouteMeta = {},
  >(
    childPrefix: ChildPrefix,
    childOptions?: ChildOptions,
    childMeta?: ChildMeta,
  ): RouteGroup<
    JoinPath<Prefix, ChildPrefix>,
    MergeGroupOptions<Options, WithMeta<ChildOptions, ChildMeta>>
  > => {
    return createGroup(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      joinPath(prefix, childPrefix) as JoinPath<Prefix, ChildPrefix>,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      mergeRouteOptions(
        options,
        withMeta(childOptions ?? {}, childMeta ?? {}),
      ) as MergeGroupOptions<Options, WithMeta<ChildOptions, ChildMeta>>,
    )
  }

  return {
    get: factory('GET'),
    post: factory('POST'),
    put: factory('PUT'),
    patch: factory('PATCH'),
    del: factory('DELETE'),
    delete: factory('DELETE'),
    head: factory('HEAD'),
    options: factory('OPTIONS'),
    all: factory('ALL'),
    group: nestedGroup,
  }
}

export function defineGroup<const Prefix extends string, const Options extends RouteOptions = {}>(
  prefix: Prefix,
  options?: Options,
): RouteGroup<Prefix, Options>

export function defineGroup<
  const Prefix extends string,
  const Options extends RouteOptions = {},
  const Meta extends RouteMeta = {},
>(prefix: Prefix, options: Options, meta: Meta): RouteGroup<Prefix, WithMeta<Options, Meta>>

export function defineGroup(
  prefix: string,
  options: RouteOptions = {},
  meta: RouteMeta = {},
): RouteGroup<string, RouteOptions> {
  return createGroup(prefix, withMeta(options, meta))
}
