// src/api/axiosConfig.ts
import axios from 'axios'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8011'
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/`,
  withCredentials: true,
})
