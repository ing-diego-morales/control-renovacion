<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, Sun, Moon, LogOut, ChevronDown } from 'lucide-vue-next'
import { session, clearSession } from '../auth'
import { useTheme } from '../theme'

defineEmits(['menu'])

const route = useRoute()
const router = useRouter()
const { dark, toggle } = useTheme()
const menuOpen = ref(false)
const initial = computed(() => (session.user?.name || '?').charAt(0).toUpperCase())

function logout() {
  clearSession()
  menuOpen.value = false
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <button class="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Mostrar u ocultar menú" @click="$emit('menu')">
      <Menu class="size-6" />
    </button>
    <h2 class="text-base font-semibold">{{ route.meta.title }}</h2>

    <div class="ml-auto flex items-center gap-2">
      <button class="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        :title="dark ? 'Modo día' : 'Modo noche'" @click="toggle">
        <component :is="dark ? Sun : Moon" class="size-5" />
      </button>

      <div class="relative">
        <button class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" @click="menuOpen = !menuOpen">
          <span class="grid size-8 place-items-center rounded-full bg-emerald-600 text-sm font-medium text-white">{{ initial }}</span>
          <span class="hidden max-w-40 truncate text-sm sm:block">{{ session.user?.name }}</span>
          <ChevronDown class="size-4 text-slate-400" />
        </button>

        <template v-if="menuOpen">
          <div class="fixed inset-0 z-30" @click="menuOpen = false" />
          <div class="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div class="px-3 py-2">
              <p class="truncate text-sm font-medium">{{ session.user?.name }}</p>
              <p class="truncate text-xs text-slate-500">{{ session.user?.email }}</p>
            </div>
            <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50" @click="logout">
              <LogOut class="size-4" /> Cerrar sesión
            </button>
          </div>
        </template>
      </div>
    </div>
  </header>
</template>