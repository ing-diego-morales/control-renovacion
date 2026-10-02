<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Tv, Sun, Moon, Eye, EyeOff } from 'lucide-vue-next'
import { api } from '../api'
import { setSession } from '../auth'
import { useTheme } from '../theme'

const router = useRouter()
const route = useRoute()
const { dark, toggle } = useTheme()

const email = ref('')
const password = ref('')
const show = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const { token, user } = await api.post('/auth/login', { email: email.value, password: password.value })
    setSession(token, user)
    router.push(route.query.redirect || '/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="hidden flex-col justify-between bg-indigo-950 p-12 text-indigo-100 lg:flex">
      <div class="flex items-center gap-2.5 text-white">
        <img src="/logo.png" alt="Logo de la empresa" class="mx-auto max-h-16 w-auto object-contain" @error="logoOk = false" />
        <span class="text-xl font-semibold">Control Streaming</span>
      </div>
      <div>
        <p class="max-w-md text-4xl font-semibold leading-tight text-white">Cada cuenta, cada cliente y cada fecha en su lugar.</p>
        <p class="mt-4 max-w-md text-indigo-300">Ya no se te pasan los vencimientos: el panel te dice a quién renovar y a quién cortar.</p>
      </div>
      <p class="text-sm text-indigo-400">Uso privado</p>
    </div>

    <div class="relative flex items-center justify-center p-6">
      <button class="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        :title="dark ? 'Modo día' : 'Modo noche'" @click="toggle">
        <component :is="dark ? Sun : Moon" class="size-5" />
      </button>

      <form class="w-full max-w-sm space-y-5" @submit.prevent="submit">
        <div>
          <h1 class="text-2xl font-semibold">Iniciar sesión</h1>
          <p class="text-slate-500">Entra para administrar tu negocio.</p>
        </div>

        <p v-if="error" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ error }}</p>

        <label class="block text-sm">Correo
          <input v-model="email" type="email" required autocomplete="username"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>

        <label class="block text-sm">Contraseña
          <div class="relative mt-1">
            <input v-model="password" :type="show ? 'text' : 'password'" required autocomplete="current-password"
              class="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-10" />
            <button type="button" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
              :aria-label="show ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="show = !show">
              <component :is="show ? EyeOff : Eye" class="size-5" />
            </button>
          </div>
        </label>

        <button :disabled="loading"
          class="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
          {{ loading ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>