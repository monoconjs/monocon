import { inject } from 'monocon'

import { auth } from './auth.ts'

export const INJECTS = inject({
  __global: true,
  auth,
})
