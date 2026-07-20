import { api } from '@/lib/api'

export interface User {
  id: string
  email: string
}

interface TokenResponse {
  access_token: string
  token_type: string
}

export async function registerUser(email: string, password: string): Promise<string> {
  const { data } = await api.post<TokenResponse>('/api/auth/register', { email, password })
  return data.access_token
}

export async function loginUser(email: string, password: string): Promise<string> {
  const form = new URLSearchParams()
  form.set('username', email)
  form.set('password', password)
  const { data } = await api.post<TokenResponse>('/api/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data.access_token
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/api/auth/me')
  return data
}
