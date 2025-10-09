//frontend/web/src/components/Login.tsx
// frontend/web/src/pages/auth/LoginPage.tsx
import React from 'react'
import Login from '../../components/Auth/Login'
import AuthLayout from './AuthLayout'

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in to TuChati" subtitle="Start connecting instantly with your community.">
      <Login />
    </AuthLayout>
  )
}
