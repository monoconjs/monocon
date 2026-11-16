import type { RuntimeEndpoint } from './endpoint.ts'

export interface Matcher {
  readonly match: (method: string, path: string) => RuntimeEndpoint | undefined
}

export function createMatcher(endpoints: readonly RuntimeEndpoint[]): Matcher {
  const routes = endpoints.map((endpoint) => ({
    endpoint,
    method: endpoint['~method'],
    path: endpoint['~path'],
  }))

  return {
    match(method, path) {
      let best: RuntimeEndpoint | undefined
      let bestScore = -1

      for (const route of routes) {
        const exact = route.method === method
        if (!exact && route.method !== 'ALL') continue

        const score = pathScore(route.path, path)
        if (score === undefined) continue

        const total = (exact ? 1000 : 0) + score
        if (total > bestScore) {
          best = route.endpoint
          bestScore = total
        }
      }

      return best
    },
  }
}

function pathScore(pattern: string, path: string): number | undefined {
  const patternParts = splitPath(pattern)
  const pathParts = splitPath(path)
  let score = 0

  for (let index = 0; index < patternParts.length; index++) {
    const part = patternParts[index]
    if (part === undefined) continue
    if (part === '*') return score + 1

    const value = pathParts[index]
    if (value === undefined) return undefined

    if (part.startsWith(':')) {
      score += 2
    } else if (part === value) {
      score += 3
    } else {
      return undefined
    }
  }

  return pathParts.length === patternParts.length ? score : undefined
}

function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part !== '')
}
