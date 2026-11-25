export interface ModuleMeta {
  prefix?: string
  summary?: string
  [key: string]: unknown
}

export type MetaPrefix<Meta> = Meta extends { prefix: infer Prefix extends string } ? Prefix : ''
