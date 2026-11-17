import type { RuntimeEndpoint } from './endpoint.ts'

export interface Matcher {
  readonly match: (method: string, path: string) => RuntimeEndpoint | undefined
}

interface Candidate {
  readonly endpoint: RuntimeEndpoint
  readonly method: string
  readonly patternParts: readonly string[]
}

export function createMatcher(endpoints: readonly RuntimeEndpoint[]): Matcher {
  const candidates: Candidate[] = endpoints.map((endpoint) => ({
    endpoint,
    method: endpoint['~method'],
    patternParts: splitPath(endpoint['~path']),
  }))

  return {
    match(method, path) {
      const pathParts = splitPath(path)
      let best: RuntimeEndpoint | undefined
      let bestScore = -1

      for (const candidate of candidates) {
        const exact = candidate.method === method
        if (!exact && candidate.method !== 'ALL') continue

        const score = pathScore(candidate.patternParts, pathParts)
        if (score === undefined) continue

        const total = (exact ? 1000 : 0) + score
        if (total > bestScore) {
          best = candidate.endpoint
          bestScore = total
        }
      }

      return best
    },
  }
}

function pathScore(
  patternParts: readonly string[],
  pathParts: readonly string[],
): number | undefined {
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
