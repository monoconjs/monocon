import type { Simplify } from './_utils.ts'

type SplitPath<Path extends string> = Path extends `${infer Head}/${infer Rest}`
  ? [Head, ...SplitPath<Rest>]
  : [Path]

type SegmentsToParams<Segments extends readonly string[]> = Segments extends readonly [
  infer Head extends string,
  ...infer Rest extends readonly string[],
]
  ? Head extends `:${infer Name}`
    ? { [Key in Name]: string } & SegmentsToParams<Rest>
    : Head extends '*'
      ? { wildcard: string } & SegmentsToParams<Rest>
      : SegmentsToParams<Rest>
  : {}

export type PathParams<Path extends string> = Simplify<SegmentsToParams<SplitPath<Path>>>
