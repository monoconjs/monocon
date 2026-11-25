import type { RouteBuilder } from './types/route.ts'

declare global {
  const get: RouteBuilder
  const post: RouteBuilder
  const put: RouteBuilder
  const patch: RouteBuilder
  const del: RouteBuilder
  const head: RouteBuilder
  const options: RouteBuilder
}
