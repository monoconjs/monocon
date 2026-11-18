export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface ContextBase<
  Params extends object,
  Query,
  Body,
  Meta extends object,
  Output,
  HeadersType,
  HeaderName extends string,
> {
  readonly req: Request
  readonly url: URL
  readonly method: string
  readonly params: Params
  readonly query: Query
  readonly body: Body
  readonly headers: HeadersType
  readonly meta: Meta

  readonly header: (name: HeaderName) => string | undefined
  readonly raw: () => Promise<string>
  readonly form: () => Promise<FormData>

  readonly json: (data: Output, init?: number | ResponseInit) => Response
  readonly text: (body: string, init?: number | ResponseInit) => Response
  readonly html: (body: string, init?: number | ResponseInit) => Response
  readonly redirect: (location: string, status?: number) => Response
}

export type Context<
  Extras extends object = {},
  Params extends object = Record<string, string>,
  Query = URLSearchParams,
  Body = unknown,
  Meta extends object = Record<string, never>,
  Output = JsonValue,
  HeadersType = Headers,
  HeaderName extends string = string,
> = ContextBase<Params, Query, Body, Meta, Output, HeadersType, HeaderName> & Extras
