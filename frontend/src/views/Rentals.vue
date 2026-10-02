<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Search, MessageCircle, RefreshCw, Scissors, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { api } from '../api'
import { money, whatsappUrl, daysChip, formatPhone, trashReasons } from '../utils'

const route = useRoute()

const tabs = [
  { value: '', label: 'Todos' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'active', label: 'Al día' },
  { value: 'cancelled', label: 'Cancelados' },
]
const stateUi = {
  expired: { label: 'Vencido', cls: 'bg-rose-100 text-rose-700' },
  expiring: { label: 'Por vencer', cls: 'bg-amber-100 text-amber-800' },
  active: { label: 'Al día', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d) }
const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const limit = 25
const state = ref(route.query.state || '')
const q = ref('')
const loading = ref(false)
const error = ref('')
const notice = ref('')
const selected = ref([])
const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: page.value, limit })
    if (state.value) params.set('state', state.value)
    if (q.value.trim()) params.set('q', q.value.trim())
    const res = await api.get(`/rentals?${params}`)
    rows.value = res.data
    total.value = res.total
    selected.value = []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const reload = () => (page.value === 1 ? load() : (page.value = 1))
let timer
watch(q, () => { clearTimeout(timer); timer = setTimeout(reload, 300) })
watch(state, reload)
watch(() => route.query.state, (s) => { state.value = s || '' })
watch(page, load)
onMounted(load)

const allOnPage = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.includes(r.id)))
const toggleAll = () => { selected.value = allOnPage.value ? [] : rows.value.map((r) => r.id) }
const toggle = (id) => {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

const showNew = ref(false)
const customers = ref([])
const products = ref([])
const freeCount = ref(null)
const nfError = ref('')
const nfSaving = ref(false)
const nf = reactive({ customer_id: '', product_id: '', quantity: 1, price: 0, end_date: '' })

const customerNote = computed(() => customers.value.find((c) => c.id === nf.customer_id)?.notes || '')
const totalPrice = computed(() => (Number(nf.price) || 0) * (Number(nf.quantity) || 0))

async function openNew() {
  nfError.value = ''
  freeCount.value = null
  Object.assign(nf, { customer_id: '', product_id: '', quantity: 1, price: 0, end_date: inDays(30) })
  showNew.value = true
  try {
    const [c, p] = await Promise.all([api.get('/customers'), api.get('/products')])
    customers.value = c
    products.value = p
  } catch (e) {
    nfError.value = e.message
  }
}

watch(() => nf.product_id, async (id) => {
  freeCount.value = null
  const p = products.value.find((x) => x.id === id)
  if (!p) return
  nf.price = Number(p.price)
  nf.end_date = inDays(Number(p.duration_days) || 30)
  try { freeCount.value = (await api.get(`/accounts?state=free&product_id=${id}&limit=1`)).total } catch { /* se ignora */ }
})

async function saveNew() {
  nfError.value = ''
  if (!nf.customer_id || !nf.product_id) { nfError.value = 'Elige el cliente y el servicio'; return }
  if (!nf.end_date) { nfError.value = 'Indica la fecha de vencimiento'; return }
  const qty = Number(nf.quantity)
  if (!qty || qty < 1) { nfError.value = 'La cantidad debe ser al menos 1'; return }
  if (freeCount.value !== null && qty > freeCount.value) {
    nfError.value = `Solo hay ${freeCount.value} ${freeCount.value === 1 ? 'cuenta libre' : 'cuentas libres'} de este servicio`
    return
  }
  nfSaving.value = true
  try {
    await api.post('/rentals', {
      customer_id: nf.customer_id, product_id: nf.product_id,
      quantity: qty, price: Number(nf.price) || 0, end_date: nf.end_date,
    })
    showNew.value = false
    notice.value = `${qty} ${qty === 1 ? 'cuenta asignada' : 'cuentas asignadas'} correctamente.`
    await reload()
  } catch (e) {
    nfError.value = e.message
  } finally {
    nfSaving.value = false
  }
}

const renewIds = ref([])
const renewError = ref('')
const renew = reactive({ mode: 'days', days: 30, date: '' })

function askRenew(ids) {
  notice.value = ''
  renewError.value = ''
  Object.assign(renew, { mode: 'days', days: 30, date: inDays(30) })
  renewIds.value = ids
}

async function confirmRenew() {
  renewError.value = ''
  const body = { ids: renewIds.value }
  if (renew.mode === 'date') {
    if (!renew.date) { renewError.value = 'Elige la fecha de vencimiento'; return }
    body.end_date = renew.date
  } else {
    body.days = Number(renew.days) || 30
  }
  try {
    const r = await api.post('/rentals/renew', body)
    notice.value = `${r.renewed} ${r.renewed === 1 ? 'alquiler renovado' : 'alquileres renovados'}.`
    renewIds.value = []
    await load()
  } catch (e) {
    renewError.value = e.message
  }
}

const cutIds = ref([])
const cutError = ref('')
const cut = reactive({ action: 'free', reason: 'down' })

function askCut(ids) {
  notice.value = ''
  cutError.value = ''
  Object.assign(cut, { action: 'free', reason: 'down' })
  cutIds.value = ids
}

async function confirmCut() {
  cutError.value = ''
  try {
    const r = await api.post('/rentals/cancel', { ids: cutIds.value, account_action: cut.action, reason: cut.reason })
    notice.value = `${r.cancelled} ${r.cancelled === 1 ? 'alquiler cortado' : 'alquileres cortados'}.`
    cutIds.value = []
    await load()
  } catch (e) {
    cutError.value = e.message
  }
}

const editRow = ref(null)
const editError = ref('')
const ef = reactive({ price: 0, end_date: '' })

function openEdit(r) {
  editError.value = ''
  Object.assign(ef, { price: Number(r.price), end_date: r.end_date })
  editRow.value = r
}

async function saveEdit() {
  editError.value = ''
  if (!ef.end_date) { editError.value = 'Indica la fecha de vencimiento'; return }
  try {
    await api.put(`/rentals/${editRow.value.id}`, { price: Number(ef.price) || 0, end_date: ef.end_date })
    editRow.value = null
    await load()
  } catch (e) {
    editError.value = e.message
  }
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Alquileres</h1>
        <p class="text-slate-500">{{ total }} {{ total === 1 ? 'cuenta alquilada' : 'cuentas alquiladas' }}</p>
      </div>
      <button class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700" @click="openNew">
        <Plus class="size-5" /> Nuevo alquiler
      </button>
    </div>

    <!-- Filtros -->
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm">
        <button v-for="t in tabs" :key="t.value"
          :class="['rounded-md px-3 py-1.5 text-sm transition', state === t.value ? 'bg-indigo-950 text-white' : 'text-slate-600 hover:bg-slate-100']"
          @click="state = t.value">{{ t.label }}</button>
      </div>
      <div class="relative min-w-56 flex-1 sm:max-w-xs">
        <Search class="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input v-model="q" placeholder="Buscar cliente, correo o servicio" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{{ error }}</p>
    <p v-if="notice" class="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-700">{{ notice }}</p>

    <!-- Barra de selección -->
    <div v-if="selected.length" class="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
      <span class="font-medium">{{ selected.length }} seleccionados</span>
      <button class="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700" @click="askRenew(selected)"><RefreshCw class="size-4" /> Renovar</button>
      <button class="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700" @click="askCut(selected)"><Scissors class="size-4" /> Cortar</button>
      <button class="underline" @click="selected = []">Quitar selección</button>
    </div>

    <!-- Tabla -->
    <div class="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[820px] text-left text-sm">
        <thead class="border-b border-slate-100 text-slate-500">
          <tr>
            <th class="w-10 px-4 py-3"><input type="checkbox" :checked="allOnPage" aria-label="Seleccionar todos" @change="toggleAll" /></th>
            <th class="px-4 py-3 font-medium">Cliente</th>
            <th class="px-4 py-3 font-medium">Servicio</th>
            <th class="px-4 py-3 font-medium">Vencimiento</th>
            <th class="px-4 py-3 font-medium">Estado</th>
            <th class="px-4 py-3 text-right font-medium">Precio</th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!loading && !rows.length">
            <td colspan="7" class="px-4 py-10 text-center text-slate-500">No hay alquileres con ese filtro.</td>
          </tr>
          <tr v-for="r in rows" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3"><input type="checkbox" :checked="selected.includes(r.id)" @change="toggle(r.id)" /></td>
            <td class="px-4 py-3">
              <p class="font-medium">{{ r.customer_name }}</p>
              <p class="text-slate-500">{{ formatPhone(r.customer_phone) }}</p>
            </td>
            <td class="px-4 py-3">
              <p>{{ r.product_name }}</p>
              <p class="max-w-56 truncate text-slate-500">{{ r.account_email }}</p>
            </td>
            <td class="px-4 py-3">
              <template v-if="r.state !== 'cancelled'">
                <span :class="['rounded-full px-2.5 py-1 text-xs font-medium', daysChip(r.days_left).cls]">{{ daysChip(r.days_left).text }}</span>
                <p class="mt-1 text-xs text-slate-500">{{ r.end_date }}</p>
              </template>
              <p v-else class="text-slate-500">{{ r.end_date }}</p>
            </td>
            <td class="px-4 py-3">
              <span :class="['rounded-full px-2.5 py-1 text-xs font-medium', stateUi[r.state].cls]">{{ stateUi[r.state].label }}</span>
            </td>
            <td class="px-4 py-3 text-right">{{ money.format(r.price) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <a :href="whatsappUrl(r)" target="_blank" rel="noopener" title="WhatsApp" class="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><MessageCircle class="size-5" /></a>
                <template v-if="r.state !== 'cancelled'">
                  <button title="Renovar" class="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100" @click="askRenew([r.id])"><RefreshCw class="size-5" /></button>
                  <button title="Corregir precio o fecha" class="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" @click="openEdit(r)"><Pencil class="size-5" /></button>
                  <button title="Cortar servicio" class="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" @click="askCut([r.id])"><Scissors class="size-5" /></button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginación -->
    <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Página {{ page }} de {{ pages }}</span>
      <div class="flex gap-2">
        <button :disabled="page <= 1" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page--"><ChevronLeft class="size-5" /></button>
        <button :disabled="page >= pages" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page++"><ChevronRight class="size-5" /></button>
      </div>
    </div>

    <!-- Modal nuevo alquiler -->
    <div v-if="showNew" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="showNew = false">
      <form class="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="saveNew">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Nuevo alquiler</h2>
          <button type="button" aria-label="Cerrar" @click="showNew = false"><X class="size-5" /></button>
        </div>
        <p v-if="nfError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ nfError }}</p>

        <label class="block text-sm">Cliente <span class="text-rose-500">*</span>
          <select v-model="nf.customer_id" :class="inputCls">
            <option value="">Elige un cliente</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <p v-if="customerNote" class="rounded-lg bg-amber-100 p-3 text-sm text-amber-800"><strong>Nota del cliente:</strong> {{ customerNote }}</p>

        <label class="block text-sm">Servicio <span class="text-rose-500">*</span>
          <select v-model="nf.product_id" :class="inputCls">
            <option value="">Elige el servicio</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <p v-if="freeCount !== null" :class="['text-sm', freeCount ? 'text-emerald-600' : 'text-rose-600']">
          {{ freeCount }} {{ freeCount === 1 ? 'cuenta libre' : 'cuentas libres' }} de este servicio
        </p>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block text-sm">Cantidad
            <input v-model.number="nf.quantity" type="number" min="1" :max="freeCount ?? undefined" :class="inputCls" />
          </label>
          <label class="block text-sm">Precio por cuenta
            <input v-model.number="nf.price" type="number" min="0" :class="inputCls" />
          </label>
          <label class="block text-sm">Vence el
            <input v-model="nf.end_date" type="date" :class="inputCls" />
          </label>
        </div>
        <p class="text-sm text-slate-500">Total: <strong class="text-slate-900">{{ money.format(totalPrice) }}</strong> · las cuentas se asignan solas (las más antiguas primero).</p>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="showNew = false">Cancelar</button>
          <button :disabled="nfSaving" class="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{{ nfSaving ? 'Asignando…' : 'Asignar cuentas' }}</button>
        </div>
      </form>
    </div>

    <!-- Modal renovar -->
    <div v-if="renewIds.length" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="renewIds = []">
      <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="confirmRenew">
        <h2 class="text-lg font-semibold">Renovar {{ renewIds.length }} {{ renewIds.length === 1 ? 'alquiler' : 'alquileres' }}</h2>
        <p v-if="renewError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ renewError }}</p>

        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input v-model="renew.mode" type="radio" value="days" />
          <span class="flex-1">Sumar días al vencimiento</span>
          <input v-model.number="renew.days" type="number" min="1" :disabled="renew.mode !== 'days'" class="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right" />
        </label>
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input v-model="renew.mode" type="radio" value="date" />
          <span class="flex-1">Poner una fecha exacta</span>
          <input v-model="renew.date" type="date" :disabled="renew.mode !== 'date'" class="rounded-lg border border-slate-300 px-2 py-1" />
        </label>
        <p class="text-xs text-slate-500">Si ya estaba vencido, los días se cuentan desde hoy.</p>

        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="renewIds = []">Cancelar</button>
          <button class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">Renovar</button>
        </div>
      </form>
    </div>

    <!-- Modal cortar -->
    <div v-if="cutIds.length" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="cutIds = []">
      <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="confirmCut">
        <h2 class="text-lg font-semibold">Cortar {{ cutIds.length }} {{ cutIds.length === 1 ? 'alquiler' : 'alquileres' }}</h2>
        <p v-if="cutError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ cutError }}</p>
        <p class="text-sm text-slate-500">¿Qué hacemos con {{ cutIds.length === 1 ? 'la cuenta' : 'las cuentas' }}?</p>

        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><input v-model="cut.action" type="radio" value="free" /> Dejarla libre para volver a alquilarla</label>
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><input v-model="cut.action" type="radio" value="down" /> Marcarla como caída (la reviso después)</label>
        <label class="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input v-model="cut.action" type="radio" value="trash" />
          <span class="flex-1">Enviarla a la papelera</span>
          <select v-model="cut.reason" :disabled="cut.action !== 'trash'" class="rounded-lg border border-slate-300 px-2 py-1">
            <option v-for="r in trashReasons" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>

        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="cutIds = []">Cancelar</button>
          <button class="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700">Cortar</button>
        </div>
      </form>
    </div>

    <!-- Modal corregir -->
    <div v-if="editRow" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="editRow = null">
      <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="saveEdit">
        <h2 class="text-lg font-semibold">Corregir alquiler de {{ editRow.customer_name }}</h2>
        <p v-if="editError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ editError }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">Precio
            <input v-model.number="ef.price" type="number" min="0" :class="inputCls" />
          </label>
          <label class="block text-sm">Vence el
            <input v-model="ef.end_date" type="date" :class="inputCls" />
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="editRow = null">Cancelar</button>
          <button class="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">Guardar</button>
        </div>
      </form>
    </div>
  </div>
</template>