export interface Meta {
  prefix?: string
  [Key: string]: any
}

export type RouteMeta<Module extends Meta = Meta> = Omit<Module, 'prefix'>

export type MetaPrefix<M> = M extends { prefix: infer Prefix extends string } ? Prefix : ''
