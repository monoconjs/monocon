import type { Meta } from './types/meta.ts'

export function meta<const M extends Meta>(value: M): M {
  return value
}
