import type { Merge, Simplify } from './_utils.ts'
import type { RouteMethod } from './http.ts'
import type { RouteBuilder, RouteMeta, RouteOptions, RouteState } from './route.ts'

type TrimTrailingSlash<Path extends string> = Path extends `${infer Rest}/`
  ? TrimTrailingSlash<Rest>
  : Path

export type JoinPath<Prefix extends string, Path extends string> = Prefix extends ''
  ? Path
  : Prefix extends '/'
    ? Path
    : Path extends '' | '/'
      ? TrimTrailingSlash<Prefix>
      : `${TrimTrailingSlash<Prefix>}${Path extends `/${string}` ? Path : `/${Path}`}`

type MetaOf<Options> = Options extends { meta: infer Meta extends object } ? Meta : {}

export type WithMeta<
  Options extends RouteOptions,
  Meta extends RouteMeta,
> = keyof Meta extends never
  ? Options
  : Simplify<Omit<Options, 'meta'> & { meta: Simplify<Merge<MetaOf<Options>, Meta>> }>

export type MergeGroupOptions<Group extends RouteOptions, Override extends RouteOptions> = Simplify<
  Omit<Group, keyof Override | 'meta'> &
    Omit<Override, 'meta'> &
    ('meta' extends keyof Group | keyof Override
      ? { meta: Simplify<Merge<MetaOf<Group>, MetaOf<Override>>> }
      : {})
>

export type GroupRouteFactory<
  Method extends RouteMethod,
  Prefix extends string,
  Options extends RouteOptions,
> = <Path extends string, RouteOpts extends RouteOptions = {}>(
  path: Path,
  options?: RouteOpts,
) => RouteBuilder<
  'onRequest',
  RouteState<Method, JoinPath<Prefix, Path>, MergeGroupOptions<Options, RouteOpts>>
>

export interface RouteGroup<Prefix extends string, Options extends RouteOptions> {
  get: GroupRouteFactory<'GET', Prefix, Options>
  post: GroupRouteFactory<'POST', Prefix, Options>
  put: GroupRouteFactory<'PUT', Prefix, Options>
  patch: GroupRouteFactory<'PATCH', Prefix, Options>
  del: GroupRouteFactory<'DELETE', Prefix, Options>
  delete: GroupRouteFactory<'DELETE', Prefix, Options>
  head: GroupRouteFactory<'HEAD', Prefix, Options>
  options: GroupRouteFactory<'OPTIONS', Prefix, Options>
  all: GroupRouteFactory<'ALL', Prefix, Options>

  group<
    ChildPrefix extends string,
    ChildOptions extends RouteOptions = {},
    ChildMeta extends RouteMeta = {},
  >(
    prefix: ChildPrefix,
    options?: ChildOptions,
    meta?: ChildMeta,
  ): RouteGroup<
    JoinPath<Prefix, ChildPrefix>,
    MergeGroupOptions<Options, WithMeta<ChildOptions, ChildMeta>>
  >
}
