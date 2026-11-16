export type MaybePromise<T> = T | Promise<T>

export type Simplify<T> = { [Key in keyof T]: T[Key] } & {}

export type Merge<Base, Override> = Simplify<Omit<Base, keyof Override> & Override>

export type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Result) => void
  ? Result
  : never
