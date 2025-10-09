// src/routes/ProtectedRoute.tsx
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { token } = useAuth()
  // Bounce unauthenticated users back to home
  if (!token) return <Navigate to="/" replace />
  return <Outlet />
}

