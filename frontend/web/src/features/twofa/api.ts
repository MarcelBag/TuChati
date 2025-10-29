/* frontend/web/src/features/twofa/api.ts */
import { apiFetch } from '../../shared/api'

export type VerificationStartPayload = {
  email?: string
  username?: string
}

export type VerificationCodePayload = {
  verification_id: string
  code: string
}

type BaseResponse = {
  detail?: string
  verification_id?: string
  expires_in?: number
}

async function postJson(path: string, body: any, skipAuth = true): Promise<any> {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    skipAuth,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.detail || data?.message || 'Request failed.'
    throw new Error(message)
  }
  return data
}

export async function startSignupVerification(payload: VerificationStartPayload): Promise<BaseResponse> {
  return postJson('/api/accounts/register/start/', payload)
}

export async function verifySignupCode(payload: VerificationCodePayload): Promise<BaseResponse> {
  return postJson('/api/accounts/register/verify/', payload)
}

export async function completeSignup(payload: VerificationCodePayload & { password: string }): Promise<BaseResponse> {
  return postJson('/api/accounts/register/complete/', payload)
}

export async function startPasswordReset(identifier: string): Promise<BaseResponse> {
  return postJson('/api/accounts/password/reset/', { identifier })
}

export async function verifyPasswordReset(payload: VerificationCodePayload): Promise<BaseResponse> {
  return postJson('/api/accounts/password/reset/verify/', payload)
}

export async function completePasswordReset(payload: VerificationCodePayload & { password: string }): Promise<BaseResponse> {
  return postJson('/api/accounts/password/reset/confirm/', { ...payload, new_password: payload.password })
}
