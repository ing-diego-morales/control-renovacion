import { session, clearSession } from './auth'

const BASE = import.meta.env.VITE_API_URL

async function req(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (session.token) headers.Authorization = `Bearer ${session.token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(
      `No se pudo conectar con el servidor (${BASE}). Revisa que el backend esté encendido ` +
      `(en la carpeta backend: npm run dev) y que MySQL esté iniciado en XAMPP.`
    )
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))

  if (res.status === 401 && path !== '/auth/login') {
    clearSession()
    window.location.assign('/login')
  }
  if (!res.ok) {
    const msg = data.error || `Error ${res.status}`
    throw new Error(data.detail ? `${msg}: ${data.detail}` : msg)
  }
  return data
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body }),
  put: (p, body) => req(p, { method: 'PUT', body }),
  del: (p) => req(p, { method: 'DELETE' }),
}