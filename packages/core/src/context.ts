type RedirectStatus = NonNullable<Parameters<typeof Response.redirect>[1]>

export type RuntimeContext = Record<string, unknown> & {
  readonly req: Request
  readonly url: URL
  readonly method: string
  readonly headers: Headers
  readonly params: Record<string, unknown>
  readonly query: unknown
  readonly body: unknown
  readonly meta: object
  readonly header: (name: string) => string | undefined
  readonly raw: () => Promise<string>
  readonly form: () => Promise<FormData>
  readonly json: (data: unknown, init?: number | ResponseInit) => Response
  readonly text: (data: string, init?: number | ResponseInit) => Response
  readonly html: (data: string, init?: number | ResponseInit) => Response
  readonly redirect: (location: string, status?: RedirectStatus) => Response
}

export interface ContextInput {
  readonly req: Request
  readonly url: URL
  readonly params: Record<string, unknown>
  readonly query: unknown
  readonly body: unknown
  readonly meta: object
}

export function createContext(input: ContextInput): RuntimeContext {
  const { req, url, params, query, body, meta } = input

  const context: RuntimeContext = {
    req,
    url,
    method: req.method,
    headers: req.headers,
    params,
    query,
    body,
    meta,
    header(name) {
      return req.headers.get(name) ?? undefined
    },
    raw() {
      return req.clone().text()
    },
    form() {
      return req.clone().formData()
    },
    json(data, init) {
      return jsonResponse(data, init)
    },
    text(data, init) {
      return new Response(data, withStatus({ 'content-type': 'text/plain; charset=utf-8' }, init))
    },
    html(data, init) {
      return new Response(data, withStatus({ 'content-type': 'text/html; charset=utf-8' }, init))
    },
    redirect(location, status = 302) {
      return Response.redirect(location, status)
    },
  }

  return context
}

function jsonResponse(data: unknown, init?: number | ResponseInit): Response {
  const responseInit = withStatus({ 'content-type': 'application/json' }, init)
  return new Response(JSON.stringify(data), responseInit)
}

function withStatus(headers: Record<string, string>, init?: number | ResponseInit): ResponseInit {
  if (typeof init === 'number') return { status: init, headers }
  if (!init) return { headers }

  const merged = new Headers(headers)
  if (init.headers) {
    for (const [name, value] of new Headers(init.headers)) merged.set(name, value)
  }
  return { ...init, headers: merged }
}

export async function parseBody(req: Request): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined

  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) return req.json()
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    return req.formData()
  }

  const text = await req.text()
  return text === '' ? undefined : text
}

export function parseQuery(url: URL): URLSearchParams {
  return url.searchParams
}

export function extractParams(pattern: string, path: string): Record<string, string> {
  const params: Record<string, string> = {}
  const patternParts = splitPath(pattern)
  const pathParts = splitPath(path)

  for (let index = 0; index < patternParts.length; index++) {
    const patternPart = patternParts[index]
    const pathPart = pathParts[index]

    if (patternPart?.startsWith(':')) {
      if (pathPart !== undefined) params[patternPart.slice(1)] = decodeURIComponent(pathPart)
      continue
    }

    if (patternPart === '*') {
      const rest = pathParts.slice(index).map(decodeURIComponent).join('/')
      params.wildcard = rest
      break
    }
  }

  return params
}

function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part !== '')
}
