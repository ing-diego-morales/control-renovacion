<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { LayoutDashboard, CalendarClock, Users, KeyRound, Package, Tags, Trash2, X, Tv } from 'lucide-vue-next'

defineProps({ open: Boolean, collapsed: Boolean })
defineEmits(['close'])

const logoOk = ref(true)

const groups = [
  {
    title: 'Operación',
    items: [
      { to: '/', label: 'Panel', icon: LayoutDashboard },
      { to: '/alquileres', label: 'Alquileres', icon: CalendarClock },
      { to: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/cuentas', label: 'Cuentas', icon: KeyRound },
      { to: '/productos', label: 'Productos', icon: Package },
      { to: '/categorias', label: 'Categorías', icon: Tags },
      { to: '/papelera', label: 'Papelera', icon: Trash2 },
    ],
  },
]
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-30 bg-black/50 lg:hidden" @click="$emit('close')" />

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-indigo-950 text-indigo-200 transition-transform duration-200',
      open ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0',
    ]"
  >
    <div class="flex items-center justify-between px-5 py-5">
      <div class="flex items-center gap-2.5 text-white">
        <span class="grid size-9 place-items-center rounded-lg bg-emerald-500"><Tv class="size-5" /></span>
        <span class="text-lg font-semibold">Control Streaming</span>
      </div>
      <button class="lg:hidden" @click="$emit('close')" aria-label="Cerrar menú"><X class="size-5" /></button>
    </div>

    <!-- Logo de la empresa -->
    <div v-if="logoOk" class="mx-4 mb-2 rounded-xl bg-white/10 p-3">
      <img src="/logo.png" alt="Logo de la empresa" class="mx-auto max-h-16 w-auto object-contain" @error="logoOk = false" />
    </div>

    <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      <div v-for="g in groups" :key="g.title">
        <p class="mb-1 px-3 text-xs text-indigo-400">{{ g.title }}</p>
        <RouterLink
          v-for="i in g.items"
          :key="i.to"
          :to="i.to"
          exact-active-class="!bg-white/10 !text-white"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 hover:text-white"
          @click="$emit('close')"
        >
          <component :is="i.icon" class="size-5" />
          {{ i.label }}
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>