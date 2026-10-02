<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Search, RotateCcw, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, Info } from 'lucide-vue-next'
import { api } from '../api'
import { trashReasons, reasonLabel } from '../utils'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const limit = 25
const reason = ref('')
const q = ref('')
const loading = ref(false)
const error = ref('')
const notice = ref('')
const revealed = ref({})
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

const tabs = [{ value: '', label: 'Todas' }, ...trashReasons]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: page.value, limit })
    if (reason.value) params.set('reason', reason.value)
    if (q.value.trim()) params.set('q', q.value.trim())
    const res = await api.get(`/accounts/trash?${params}`)
    rows.value = res.data
    total.value = res.total
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const reload = () => (page.value === 1 ? load() : (page.value = 1))
let timer
watch(q, () => { clearTimeout(timer); timer = setTimeout(reload, 300) })
watch(reason, reload)
watch(page, load)
onMounted(load)

async function restore(r) {
  notice.value = ''
  try { await api.post(`/accounts/${r.id}/restore`); notice.value = `${r.email} volvió a Cuentas como libre.`; await load() }
  catch (e) { error.value = e.message }
}

async function purge(r) {
  if (!confirm(`¿Eliminar definitivamente ${r.email}? No se puede deshacer.`)) return
  notice.value = ''
  try { await api.del(`/accounts/${r.id}/purge`); await load() }
  catch (e) { error.value = e.message }
}

async function emptyAll() {
  if (!confirm('¿Vaciar toda la papelera? Las cuentas se borran definitivamente.')) return
  try {
    const r = await api.del('/accounts/trash')
    notice.value = `${r.deleted} cuentas eliminadas definitivamente.`
    await load()
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Papelera</h1>
        <p class="text-slate-500">{{ total }} {{ total === 1 ? 'cuenta' : 'cuentas' }}</p>
      </div>
      <button :disabled="!total" class="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-700 disabled:opacity-40" @click="emptyAll">
        <Trash2 class="size-5" /> Vaciar papelera
      </button>
    </div>

    <p class="mt-4 flex items-start gap-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
      <Info class="mt-0.5 size-4 shrink-0" />
      Las cuentas se borran solas a los 30 días. Antes de eso puedes restaurarlas (vuelven a Cuentas como libres) o eliminarlas a mano.
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm">
        <button v-for="t in tabs" :key="t.value"
          :class="['rounded-md px-3 py-1.5 text-sm transition', reason === t.value ? 'bg-indigo-950 text-white' : 'text-slate-600 hover:bg-slate-100']"
          @click="reason = t.value">{{ t.label }}</button>
      </div>
      <div class="relative min-w-56 flex-1 sm:max-w-xs">
        <Search class="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input v-model="q" placeholder="Buscar correo o servicio" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{{ error }}</p>
    <p v-if="notice" class="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-700">{{ notice }}</p>

    <div class="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[800px] text-left text-sm">
        <thead class="border-b border-slate-100 text-slate-500">
          <tr>
            <th class="px-4 py-3 font-medium">Servicio</th>
            <th class="px-4 py-3 font-medium">Correo</th>
            <th class="px-4 py-3 font-medium">Contraseña</th>
            <th class="px-4 py-3 font-medium">Motivo</th>
            <th class="px-4 py-3 font-medium">Eliminada</th>
            <th class="px-4 py-3 font-medium">Se borra en</th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!loading && !rows.length">
            <td colspan="7" class="px-4 py-10 text-center text-slate-500">La papelera está vacía.</td>
          </tr>
          <tr v-for="r in rows" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium">{{ r.product_name }}</td>
            <td class="max-w-56 truncate px-4 py-3">{{ r.email }}</td>
            <td class="px-4 py-3">
              <span class="font-mono">{{ revealed[r.id] ? r.password || '—' : '••••••' }}</span>
              <button class="ml-2 align-middle text-slate-400 hover:text-slate-700" aria-label="Mostrar u ocultar contraseña" @click="revealed[r.id] = !revealed[r.id]">
                <component :is="revealed[r.id] ? EyeOff : Eye" class="inline size-4" />
              </button>
            </td>
            <td class="px-4 py-3">{{ reasonLabel(r.delete_reason) }}</td>
            <td class="px-4 py-3">{{ r.deleted_at.slice(0, 10) }}</td>
            <td class="px-4 py-3">
              <span :class="['rounded-full px-2.5 py-1 text-xs font-medium', r.days_left <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600']">
                {{ r.days_left }} {{ Number(r.days_left) === 1 ? 'día' : 'días' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <button title="Restaurar" class="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" @click="restore(r)"><RotateCcw class="size-4" /></button>
                <button title="Eliminar definitivamente" class="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" @click="purge(r)"><Trash2 class="size-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Página {{ page }} de {{ pages }}</span>
      <div class="flex gap-2">
        <button :disabled="page <= 1" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page--"><ChevronLeft class="size-5" /></button>
        <button :disabled="page >= pages" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page++"><ChevronRight class="size-5" /></button>
      </div>
    </div>
  </div>
</template>