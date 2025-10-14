// Central fetch with base URL, single-flight refresh, and /me cooldown

let accessToken: string | null = null
let refreshToken: string | null = null

// === Base URLs from env (no trailing slash) ===
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

// Build absolute URL from relative input
function makeUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input
  const path = input.startsWith('/') ? input : `/${input}`
  return API_BASE ? `${API_BASE}${path}` : path
}

// Token helpers
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

// === Single-flight refresh ===
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
      const data: any = await res.json().catch(() => ({}))
      const newAccess = data.access || data.token || data.access_token
      if (!newAccess) throw new Error('bad-refresh-payload')
      setTokens(newAccess, refreshToken)
    })().finally(() => { refreshingPromise = null })
  }
  return refreshingPromise
}

// === /me cooldown to prevent stampede ===
let meCooldownUntil = 0        // epoch ms until which new /me calls are blocked
let meInFlight: Promise<Response> | null = null

function isMeUrl(url: string) {
  return /\/api\/accounts\/me\/?$/.test(url)
}

type Opts = RequestInit & { skipAuth?: boolean; retryOn401?: boolean }

export async function apiFetch(input: string, init: Opts = {}) {
  const { skipAuth, retryOn401 = true, headers, ...rest } = init
  const url = makeUrl(input)

  // /me cooldown: if we just succeeded/failed, avoid a new call for 1500ms
  const now = Date.now()
  if (isMeUrl(url)) {
    if (meInFlight) return meInFlight
    if (now < meCooldownUntil) {
      // Serve a synthetic 429 to callers so they don't keep trying
      return new Response(null, { status: 429, statusText: 'Too Many Requests (me cooldown)' }) as any
    }
  }

  const h: Record<string, string> = { ...(headers as any) }
  if (!skipAuth && accessToken) h.Authorization = `Bearer ${accessToken}`

  const doFetch = () => fetch(url, { ...rest, headers: h })

  const run = async (): Promise<Response> => {
    let res = await doFetch()

    // If this is /me, expose it as single in-flight promise
    if (isMeUrl(url)) {
      meInFlight = Promise.resolve(res)
      try {
        // consume once by the first caller; others should only check status/ok
        // Set a small cooldown regardless of result to avoid stampede
        meCooldownUntil = Date.now() + 1500
      } finally {
        // release the in-flight promise on next tick
        setTimeout(() => { meInFlight = null }, 0)
      }
    }

    // Non-401 or opted-out: return
    const isRefreshCall = /\/api\/accounts\/token\/refresh\/?$/.test(url)
    if (res.status !== 401 || skipAuth || !retryOn401 || isRefreshCall) return res

    // Attempt refresh, then retry once with new access
    try {
      await refreshOnce()
      const h2: Record<string, string> = { ...(headers as any) }
      if (accessToken) h2.Authorization = `Bearer ${accessToken}`
      return await fetch(url, { ...rest, headers: h2 })
    } catch {
      return res
    }
  }

  return run()
}
export async function ensureFreshAccess(): Promise<string | null> {
  // A no-op authenticated GET that will trigger a refresh if needed
  const res = await apiFetch('/api/accounts/me/', { retryOn401: true })
  // We don’t care about payload here; we just want the side-effect
  if (res.ok) {
    const a = localStorage.getItem('access')
    return a || null
  }
  return null
}