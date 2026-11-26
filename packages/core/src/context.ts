import { isRecord, isStringRecord, SchemaValidationError, validateSchema } from './schema.ts'
import type { Schema, SchemaOptions } from './types/schema.ts'

export interface RuntimeContext extends Record<string, unknown> {
  readonly req: Request
  readonly url: URL
  readonly method: string
  readonly params: Record<string, string>
  readonly query: unknown
  readonly body: unknown
  readonly headers: Headers
  readonly meta: Record<string, unknown>
  readonly header: (name: string) => string | undefined
  readonly raw: () => Promise<string>
  readonly form: () => Promise<FormData>
  readonly json: (data: unknown, init?: number | ResponseInit) => Response
  readonly text: (body: string, init?: number | ResponseInit) => Response
  readonly html: (body: string, init?: number | ResponseInit) => Response
  readonly redirect: (location: string, status?: number) => Response
}

export interface CreateContextOptions {
  readonly request: Request
  readonly url: URL
  readonly params: Record<string, string>
  readonly meta: Record<string, unknown>
  readonly schemas: SchemaOptions
}

const responseData = new WeakMap<Response, unknown>()

export function getResponseData(response: Response): unknown {
  return responseData.get(response)
}

export async function createContext(options: CreateContextOptions): Promise<RuntimeContext> {
  const { request, url, schemas } = options

  const headers = new Headers(request.headers)
  const requestHeaders: Record<string, string> = {}
  request.headers.forEach((value, name) => {
    requestHeaders[name] = value
  })
  const parsedHeaders = await validateSchema(schemas.headers, requestHeaders)
  if (isRecord(parsedHeaders)) {
    for (const [name, value] of Object.entries(parsedHeaders)) {
      Object.defineProperty(headers, name, {
        value,
        enumerable: true,
        configurable: true,
      })
    }
  }

  const query =
    schemas.query === undefined
      ? url.searchParams
      : await validateSchema(schemas.query, Object.fromEntries(url.searchParams.entries()))

  const params = await validateSchema(schemas.params, options.params)
  if (!isStringRecord(params)) {
    throw new SchemaValidationError([{ message: 'Invalid route params' }])
  }
  const { value: body, text: bodyText } = await readBody(request, schemas.body)

  const context: RuntimeContext = {
    req: request,
    url,
    method: request.method,
    params,
    query,
    body,
    headers,
    meta: options.meta,
    header: (name) => headers.get(name) ?? undefined,
    raw: async () => bodyText,
    form: async () => parseForm(bodyText, request.headers.get('content-type')),
    json: (data, init) => {
      const response = Response.json(data, normalizeInit(init))
      responseData.set(response, data)
      return response
    },
    text: (data, init) =>
      new Response(data, {
        ...normalizeInit(init),
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    html: (data, init) =>
      new Response(data, {
        ...normalizeInit(init),
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    redirect: (location, status = 302) => new Response(null, { status, headers: { location } }),
  }

  return context
}

async function readBody(
  request: Request,
  schema: Schema | undefined,
): Promise<{ value: unknown; text: string }> {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return { value: await validateSchema(schema, undefined), text: '' }
  }

  const text = await request.text()
  if (text.length === 0) {
    return { value: await validateSchema(schema, undefined), text }
  }

  const contentType = request.headers.get('content-type') ?? ''
  let value: unknown = text
  if (contentType.includes('json')) {
    try {
      value = JSON.parse(text)
    } catch {
      throw new SchemaValidationError([{ message: 'Invalid JSON body' }])
    }
  }

  return { value: await validateSchema(schema, value), text }
}

async function parseForm(text: string, contentType: string | null): Promise<FormData> {
  const response = new Response(text, {
    headers: contentType === null ? {} : { 'content-type': contentType },
  })
  return response.formData()
}

function normalizeInit(init: number | ResponseInit | undefined): ResponseInit {
  return typeof init === 'number' ? { status: init } : (init ?? {})
}
