import type { Meta as CoreMeta, RouteBuilder } from '@monocon/core'

type BaseMeta = CoreMeta

declare global {
  interface Meta extends BaseMeta {}

  interface RouteRecords {}

  const get: RouteBuilder
  const post: RouteBuilder
  const put: RouteBuilder
  const patch: RouteBuilder
  const del: RouteBuilder
  const head: RouteBuilder
  const options: RouteBuilder
}
