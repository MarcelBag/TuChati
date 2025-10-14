// frontend/web/src/shared/api.ts
// Central fetch with single-flight token refresh + guarded retries

let accessToken: string | null = null
let refreshToken: string | null = null

// --- config ---
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function makeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input
  const path = input.startsWith('/') ? input : `/${input}`
  return API_BASE ? `${API_BASE}${path}` : path
}

// read/write tokens
export function setTokens(a: string | null, r: string | null) {
  accessToken = a; refreshToken = r
  if (a) localStorage.setItem('access', a); else localStorage.removeItem('access')
  if (r) localStorage.setItem('refresh', r); else localStorage.removeItem('refresh')
}
export function loadTokensFromStorage() {
  accessToken = localStorage.getItem('access')
  refreshToken = localStorage.getItem('refresh')
}
loadTokensFromStorage()

// --- single-flight refresh gate ---
let refreshingPromise: Promise<void> | null = null
async function refreshOnce() {
  if (!refreshToken) throw new Error('no-refresh')
  if (!refreshingPromise) {
    refreshingPromise = (async () => {
      const res = await fetch(makeUrl('/api/accounts/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      })
      if (!res.ok) {
        setTokens(null, null)
        throw new Error('refresh-failed')
      }
      const data = await res.json().catch(() => ({}))
      const newAccess = (data as any).access || (data as any).token || (data as any).access_token
      if (!newAccess) throw new Error('bad-refresh-payload')
      setTokens(newAccess, refreshToken)
    })().finally(() => { refreshingPromise = null })
  }
  return refreshingPromise
}

type Opts = RequestInit & { skipAuth?: boolean; retryOn401?: boolean }

export async function apiFetch(input: string, init: Opts = {}) {
  const { skipAuth, retryOn401 = true, headers, ...rest } = init
  const url = makeUrl(input)
  const isRefresh = /\/api\/accounts\/token\/refresh\/?$/.test(url)

  const h: Record<string, string> = { ...(headers as any) }
  if (!skipAuth && accessToken) h.Authorization = `Bearer ${accessToken}`

  let res = await fetch(url, { ...rest, headers: h })
  if (res.status !== 401 || skipAuth || !retryOn401 || isRefresh) return res

  try {
    await refreshOnce()
    const h2: Record<string, string> = { ...(headers as any) }
    if (accessToken) h2.Authorization = `Bearer ${accessToken}`
    return await fetch(url, { ...rest, headers: h2 })
  } catch {
    return res
  }
}
