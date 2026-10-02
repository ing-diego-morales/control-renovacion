<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Plus, Upload, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, Eye, EyeOff, AlertTriangle, RotateCcw } from 'lucide-vue-next'
import { api } from '../api'
import { trashReasons, daysChip } from '../utils'

const route = useRoute()

const stateUi = {
  free: { label: 'Libre', cls: 'bg-emerald-100 text-emerald-700' },
  assigned: { label: 'Asignada', cls: 'bg-indigo-100 text-indigo-700' },
  down: { label: 'Caída', cls: 'bg-rose-100 text-rose-700' },
}
const tabs = [
  { value: '', label: 'Todas' },
  { value: 'free', label: 'Libres' },
  { value: 'assigned', label: 'Asignadas' },
  { value: 'down', label: 'Caídas' },
]
const sorts = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'days_asc', label: 'Vencen primero (menos días)' },
  { value: 'days_desc', label: 'Vencen al final (más días)' },
]

// ---------- Lista ----------
const rows = ref([])
const total = ref(0)
const counts = reactive({ free: 0, assigned: 0, down: 0 })
const page = ref(1)
const limit = 25
const state = ref(route.query.state || '')
const productId = ref(route.query.product_id ? Number(route.query.product_id) : '')
const sort = ref('recent')
const q = ref('')
const loading = ref(false)
const error = ref('')
const notice = ref('')
const products = ref([])
const revealed = ref({})
const selected = ref([])

const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const countOf = (v) => (v === '' ? counts.free + counts.assigned + counts.down : counts[v])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: page.value, limit, sort: sort.value })
    if (state.value) params.set('state', state.value)
    if (productId.value) params.set('product_id', productId.value)
    if (q.value.trim()) params.set('q', q.value.trim())
    const res = await api.get(`/accounts?${params}`)
    rows.value = res.data
    total.value = res.total
    Object.assign(counts, res.counts)
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
watch([state, productId, sort], reload)
watch(page, load)

onMounted(async () => {
  load()
  try { products.value = await api.get('/products') } catch (e) { error.value = e.message }
})

// ---------- Selección ----------
const allOnPage = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.includes(r.id)))
const toggleAll = () => { selected.value = allOnPage.value ? [] : rows.value.map((r) => r.id) }
const toggle = (id) => {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

// ---------- Agregar / editar una cuenta ----------
const showForm = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ product_id: '', email: '', password: '', notes: '' })

function openNew() {
  editingId.value = null
  formError.value = ''
  Object.assign(form, { product_id: productId.value || '', email: '', password: '', notes: '' })
  showForm.value = true
}

function openEdit(r) {
  editingId.value = r.id
  formError.value = ''
  Object.assign(form, { product_id: r.product_id, email: r.email, password: r.password || '', notes: r.notes || '' })
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.product_id || !form.email.trim()) {
    formError.value = 'Elige el servicio y escribe el correo'
    return
  }
  saving.value = true
  try {
    const body = { ...form, email: form.email.trim(), password: form.password.trim() }
    if (editingId.value) await api.put(`/accounts/${editingId.value}`, body)
    else await api.post('/accounts', body)
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

// ---------- Carga masiva ----------
const showBulk = ref(false)
const bulk = reactive({ product_id: '', text: '' })
const bulkResult = ref(null)
const bulkError = ref('')
const uploading = ref(false)

// Acepta "correo contraseña", "correo:contraseña", "correo,contraseña" o dos columnas pegadas desde Excel
function parseBulk(text) {
  const ok = []
  const bad = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^([^\s,;:|]+@[^\s,;:|]+)[\s,;:|]+(.+)$/)
    if (m) ok.push({ email: m[1], password: m[2].trim() })
    else bad.push(line)
  }
  return { ok, bad }
}
const parsed = computed(() => parseBulk(bulk.text))

function openBulk() {
  Object.assign(bulk, { product_id: productId.value || '', text: '' })
  bulkResult.value = null
  bulkError.value = ''
  showBulk.value = true
}

async function uploadBulk() {
  bulkError.value = ''
  if (!bulk.product_id) { bulkError.value = 'Elige el servicio'; return }
  if (!parsed.value.ok.length) { bulkError.value = 'No hay líneas válidas para subir'; return }
  uploading.value = true
  try {
    bulkResult.value = await api.post('/accounts/bulk', { product_id: bulk.product_id, items: parsed.value.ok })
    bulk.text = ''
    await load()
  } catch (e) {
    bulkError.value = e.message
  } finally {
    uploading.value = false
  }
}

// ---------- Caída ----------
async function setDown(r, down) {
  try { await api.post(`/accounts/${r.id}/down`, { down }); await load() }
  catch (e) { error.value = e.message }
}

// ---------- Papelera ----------
const trashIds = ref([])
const trashReason = ref('down')

function askTrash(ids) {
  notice.value = ''
  trashReason.value = 'down'
  trashIds.value = ids
}

async function confirmTrash() {
  try {
    const r = await api.post('/accounts/trash-many', { ids: trashIds.value, reason: trashReason.value })
    notice.value = r.skipped
      ? `${r.trashed} enviadas a la papelera. ${r.skipped} no se enviaron porque están asignadas a un cliente (córtalas primero en Alquileres).`
      : `${r.trashed} ${r.trashed === 1 ? 'cuenta enviada' : 'cuentas enviadas'} a la papelera.`
    trashIds.value = []
    await load()
  } catch (e) {
    error.value = e.message
    trashIds.value = []
  }
}

const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2'
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">Cuentas</h1>
        <p class="text-slate-500">{{ countOf('') }} en total · {{ counts.free }} libres</p>
      </div>
      <div class="flex gap-2">
        <button class="flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-medium shadow-sm hover:bg-slate-100" @click="openBulk">
          <Upload class="size-5" /> Carga masiva
        </button>
        <button class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700" @click="openNew">
          <Plus class="size-5" /> Agregar
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm">
        <button v-for="t in tabs" :key="t.value"
          :class="['rounded-md px-3 py-1.5 text-sm transition', state === t.value ? 'bg-indigo-950 text-white' : 'text-slate-600 hover:bg-slate-100']"
          @click="state = t.value">
          {{ t.label }} <span class="opacity-60">{{ countOf(t.value) }}</span>
        </button>
      </div>
      <select v-model="productId" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        <option value="">Todos los servicios</option>
        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <select v-model="sort" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Ordenar por">
        <option v-for="s in sorts" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <div class="relative min-w-56 flex-1 sm:max-w-xs">
        <Search class="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input v-model="q" placeholder="Buscar correo, servicio o cliente" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{{ error }}</p>
    <p v-if="notice" class="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-700">{{ notice }}</p>

    <!-- Barra de selección -->
    <div v-if="selected.length" class="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
      <span class="font-medium">{{ selected.length }} seleccionadas</span>
      <button class="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700" @click="askTrash(selected)">
        <Trash2 class="size-4" /> Enviar a papelera
      </button>
      <button class="underline" @click="selected = []">Quitar selección</button>
    </div>

    <!-- Tabla -->
    <div class="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[860px] text-left text-sm">
        <thead class="border-b border-slate-100 text-slate-500">
          <tr>
            <th class="w-10 px-4 py-3"><input type="checkbox" :checked="allOnPage" aria-label="Seleccionar todas" @change="toggleAll" /></th>
            <th class="px-4 py-3 font-medium">Servicio</th>
            <th class="px-4 py-3 font-medium">Correo</th>
            <th class="px-4 py-3 font-medium">Contraseña</th>
            <th class="px-4 py-3 font-medium">Estado</th>
            <th class="px-4 py-3 font-medium">Cliente y días restantes</th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!loading && !rows.length">
            <td colspan="7" class="px-4 py-10 text-center text-slate-500">
              No hay cuentas con ese filtro. Usa "Agregar" o "Carga masiva".
            </td>
          </tr>
          <tr v-for="r in rows" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3"><input type="checkbox" :checked="selected.includes(r.id)" @change="toggle(r.id)" /></td>
            <td class="px-4 py-3">
              <p class="font-medium">{{ r.product_name }}</p>
              <p class="text-slate-500">{{ r.category_name }}</p>
            </td>
            <td class="max-w-56 truncate px-4 py-3">{{ r.email }}</td>
            <td class="px-4 py-3">
              <span class="font-mono">{{ revealed[r.id] ? r.password || '—' : '••••••' }}</span>
              <button class="ml-2 align-middle text-slate-400 hover:text-slate-700" aria-label="Mostrar u ocultar contraseña" @click="revealed[r.id] = !revealed[r.id]">
                <component :is="revealed[r.id] ? EyeOff : Eye" class="inline size-4" />
              </button>
            </td>
            <td class="px-4 py-3">
              <span :class="['rounded-full px-2.5 py-1 text-xs font-medium', stateUi[r.state].cls]">{{ stateUi[r.state].label }}</span>
            </td>
            <td class="px-4 py-3">
              <template v-if="r.customer_name">
                <p>{{ r.customer_name }}</p>
                <span :class="['mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', daysChip(r.days_left).cls]">{{ daysChip(r.days_left).text }}</span>
              </template>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <button title="Editar" class="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100" @click="openEdit(r)"><Pencil class="size-4" /></button>
                <button v-if="r.state !== 'down'" title="Marcar como caída" class="grid size-9 place-items-center rounded-lg bg-amber-100 text-amber-800 hover:opacity-80" @click="setDown(r, true)"><AlertTriangle class="size-4" /></button>
                <button v-else title="Quitar estado de caída" class="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" @click="setDown(r, false)"><RotateCcw class="size-4" /></button>
                <button title="Enviar a la papelera" class="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" @click="askTrash([r.id])"><Trash2 class="size-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginación -->
    <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Página {{ page }} de {{ pages }} · {{ total }} resultados</span>
      <div class="flex gap-2">
        <button :disabled="page <= 1" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page--"><ChevronLeft class="size-5" /></button>
        <button :disabled="page >= pages" class="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40" @click="page++"><ChevronRight class="size-5" /></button>
      </div>
    </div>

    <!-- Modal agregar / editar -->
    <div v-if="showForm" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="showForm = false">
      <form class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="save">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">{{ editingId ? 'Editar cuenta' : 'Nueva cuenta' }}</h2>
          <button type="button" aria-label="Cerrar" @click="showForm = false"><X class="size-5" /></button>
        </div>
        <p v-if="formError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ formError }}</p>

        <label class="block text-sm">Servicio <span class="text-rose-500">*</span>
          <select v-model="form.product_id" :class="inputCls">
            <option value="">Elige el servicio</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">Correo <span class="text-rose-500">*</span>
            <input v-model="form.email" :class="inputCls" />
          </label>
          <label class="block text-sm">Contraseña
            <input v-model="form.password" :class="inputCls" />
          </label>
        </div>
        <label class="block text-sm">Notas
          <textarea v-model="form.notes" rows="2" :class="inputCls" />
        </label>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="showForm = false">Cancelar</button>
          <button :disabled="saving" class="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </div>

    <!-- Modal carga masiva -->
    <div v-if="showBulk" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="showBulk = false">
      <form class="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="uploadBulk">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Carga masiva de cuentas</h2>
          <button type="button" aria-label="Cerrar" @click="showBulk = false"><X class="size-5" /></button>
        </div>

        <div v-if="bulkResult" class="space-y-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
          <p class="font-medium">Se subieron {{ bulkResult.created }} cuentas.</p>
          <p v-if="bulkResult.duplicates">{{ bulkResult.duplicates }} ya existían y se omitieron<span v-if="bulkResult.duplicate_list.length">: {{ bulkResult.duplicate_list.join(', ') }}<span v-if="bulkResult.duplicates > 20">…</span></span></p>
        </div>
        <p v-if="bulkError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ bulkError }}</p>

        <label class="block text-sm">Servicio (para todas) <span class="text-rose-500">*</span>
          <select v-model="bulk.product_id" :class="inputCls">
            <option value="">Elige el servicio</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>

        <label class="block text-sm">Pega una cuenta por línea: correo y contraseña
          <textarea v-model="bulk.text" rows="10" placeholder="correo1@gmail.com clave123&#10;correo2@gmail.com:clave456&#10;correo3@gmail.com,clave789"
            :class="[inputCls, 'font-mono text-xs']" />
        </label>
        <p class="text-sm text-slate-500">
          Separa con espacio, coma, dos puntos o tabulador (puedes copiar dos columnas directo de Excel).
          Todas entran como <strong>Libres</strong>.
        </p>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm">
            <span class="font-medium text-emerald-600">{{ parsed.ok.length }} válidas</span>
            <span v-if="parsed.bad.length" class="ml-3 font-medium text-rose-600">{{ parsed.bad.length }} no se entienden</span>
          </p>
          <div class="flex gap-2">
            <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="showBulk = false">Cerrar</button>
            <button :disabled="uploading || !parsed.ok.length" class="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {{ uploading ? 'Subiendo…' : `Subir ${parsed.ok.length} cuentas` }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Modal papelera -->
    <div v-if="trashIds.length" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="trashIds = []">
      <div class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold">Enviar {{ trashIds.length }} {{ trashIds.length === 1 ? 'cuenta' : 'cuentas' }} a la papelera</h2>
        <p class="text-sm text-slate-500">Se guardan 30 días por si necesitas recuperarlas; después se borran solas.</p>
        <label class="block text-sm">Motivo
          <select v-model="trashReason" :class="inputCls">
            <option v-for="r in trashReasons" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>
        <div class="flex justify-end gap-2">
          <button class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="trashIds = []">Cancelar</button>
          <button class="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700" @click="confirmTrash">Enviar a papelera</button>
        </div>
      </div>
    </div>
  </div>
</template>