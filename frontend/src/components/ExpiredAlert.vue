<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, X } from 'lucide-vue-next'
import { api } from '../api'
import { daysChip } from '../utils'

const router = useRouter()
const info = ref({ count: 0, customers: 0, items: [] })
const visible = ref(false)

let dismissedAt = 0
let dismissedCount = 0
let timer

async function check() {
  try { info.value = await api.get('/rentals/alerts') } catch { return }
  const { count } = info.value
  if (count === 0) { visible.value = false; dismissedAt = 0; dismissedCount = 0; return }
  const snoozeOver = Date.now() - dismissedAt > 30 * 60 * 1000
  if (!dismissedAt || count > dismissedCount || snoozeOver) visible.value = true
}

function dismiss() {
  visible.value = false
  dismissedAt = Date.now()
  dismissedCount = info.value.count
}

function go() {
  dismiss()
  router.push({ path: '/alquileres', query: { state: 'expired' } })
}

onMounted(() => { check(); timer = setInterval(check, 60 * 1000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="exp-title">
    <div class="relative w-full max-w-lg rounded-2xl border-t-8 border-rose-600 bg-white p-6 shadow-2xl">
      <button class="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar aviso" @click="dismiss">
        <X class="size-6" />
      </button>

      <div class="flex items-center gap-3 pr-10 text-rose-700">
        <AlertTriangle class="size-9 shrink-0" />
        <h2 id="exp-title" class="text-xl font-bold">
          ¡{{ info.count }} {{ info.count === 1 ? 'cuenta vencida' : 'cuentas vencidas' }} sin cortar!
        </h2>
      </div>
      <p class="mt-2 text-slate-600">Ya pasó su fecha y no las has renovado ni cortado:</p>

      <ul class="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
        <li v-for="r in info.items" :key="r.customer_id" class="flex items-center justify-between gap-3 px-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ r.customer_name }}</p>
            <p class="text-sm text-slate-500">{{ r.accounts }} {{ r.accounts === 1 ? 'cuenta' : 'cuentas' }}</p>
          </div>
          <span :class="['shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', daysChip(r.worst_days).cls]">{{ daysChip(r.worst_days).text }}</span>
        </li>
      </ul>
      <p v-if="info.customers > info.items.length" class="mt-2 text-sm text-slate-500">…y {{ info.customers - info.items.length }} clientes más.</p>

      <div class="mt-6 flex justify-end">
        <button class="rounded-lg bg-rose-600 px-5 py-2.5 font-medium text-white hover:bg-rose-700" @click="go">Ver vencidos</button>
      </div>
    </div>
  </div>
</template>