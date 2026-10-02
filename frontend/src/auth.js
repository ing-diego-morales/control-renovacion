import { reactive } from 'vue'

const saved = JSON.parse(localStorage.getItem('session') || 'null')

export const session = reactive({ token: saved?.token || null, user: saved?.user || null })

export function setSession(token, user) {
  session.token = token
  session.user = user
  localStorage.setItem('session', JSON.stringify({ token, user }))
}

export function clearSession() {
  session.token = null
  session.user = null
  localStorage.removeItem('session')
}