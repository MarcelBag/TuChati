// =============================================================
//TuChati Axios Configuration
// Handles API calls to Django backend (REST endpoints)
// Auto-switches between dev (localhost) and prod environments
// =============================================================
import axios from 'axios'
// -------------------------------------------------------------
// Base API URL: uses VITE_API_BASE_URL from .env file
// Fallbacks ensure local development works even without it
// -------------------------------------------------------------
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8011'

export const api = axios.create({
// Django REST endpoints prefix
  baseURL: `${API_BASE_URL}/api/`,
  // enable cookies / CSRF handling
  withCredentials: true,
  //safety timeout
  timeout: 15000,
})

// -------------------------------------------------------------
// API usage pattern
// -------------------------------------------------------------
// import { api } from '../api/axiosConfig'
// const response = await api.get('chat/rooms/')
// -------------------------------------------------------------
