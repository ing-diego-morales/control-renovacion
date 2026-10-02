<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Plus, Search, Pencil, Trash2, X, ChevronLeft, ChevronRight, ArrowUpDown, Eye, EyeOff } from 'lucide-vue-next'
import { api } from '../api'
import PhoneInput from './PhoneInput.vue'

const props = defineProps({
  title: String,
  endpoint: String,
  noun: { type: String, default: 'registro' },
  plural: { type: String, default: 'registros' },
  columns: Array,
  fields: Array,
  pageSize: { type: Number, default: 15 },
})

// ---------- Lista ----------
const rows = ref([])
const loading = ref(false)
const error = ref('')
const q = ref('')
const page = ref(1)
const sort = reactive({ key: null, dir: 1 })
const revealed = ref({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const qs = q.value.trim() ? `?q=${encodeURIComponent(q.value.trim())}` : ''
    rows.value = await api.get(`${props.endpoint}${qs}`)
    page.value = 1
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

let timer
watch(q, () => { clearTimeout(timer); timer = setTimeout(load, 300) })

const sorted = computed(() => {
  if (!sort.key) return rows.value
  return [...rows.value].sort((a, b) =>
    String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'es', { numeric: true }) * sort.dir)
})
const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)))
const visible = computed(() => sorted.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize))

function sortBy(col) {
  if (col.sortable === false) return
  if (sort.key === col.key) sort.dir *= -1
  else { sort.key = col.key; sort.dir = 1 }
}

// ---------- Opciones de los campos tipo select ----------
const opts = reactive({})
async function loadOptions() {
  for (const f of props.fields) {
    if (f.optionsFrom) opts[f.key] = await f.optionsFrom()
    else if (f.options) opts[f.key] = f.options
  }
}

onMounted(() => { load(); loadOptions() })

// ---------- Formulario ----------
const showForm = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({})

const blank = () =>
  Object.fromEntries(props.fields.map((f) => [f.key, f.default ?? (f.type === 'number' ? 0 : '')]))

function openNew() {
  editingId.value = null
  formError.value = ''
  Object.assign(form, blank())
  showForm.value = true
}

function openEdit(row) {
  editingId.value = row.id
  formError.value = ''
  const base = blank()
  for (const f of props.fields) {
    const v = row[f.key]
    base[f.key] = v === null || v === undefined ? base[f.key] : f.type === 'number' ? Number(v) : v
  }
  Object.assign(form, base)
  showForm.value = true
}

async function save() {
  formError.value = ''
  const body = {}
  for (const f of props.fields) {
    let v = form[f.key]
        if (f.required && (v === '' || v === null || v === undefined)) {
      formError.value = f.type === 'phone'
        ? `Escribe un número de teléfono válido en "${f.label}"`
        : `Completa el campo "${f.label}"`
      return
    }
    if (f.type === 'number') v = v === '' || v === null ? 0 : Number(v)
    else if (f.type === 'select' && v === '') v = null
    else if (typeof v === 'string') v = v.trim()
    body[f.key] = v
  }
  saving.value = true
  try {
    if (editingId.value) await api.put(`${props.endpoint}/${editingId.value}`, body)
    else await api.post(props.endpoint, body)
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!confirm(`¿Eliminar este ${props.noun}?`)) return
  try { await api.del(`${props.endpoint}/${row.id}`); await load() }
  catch (e) { error.value = e.message }
}

const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2'
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">{{ title }}</h1>
        <p class="text-slate-500">{{ rows.length }} {{ rows.length === 1 ? noun : plural }}</p>
      </div>
      <button class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700" @click="openNew">
        <Plus class="size-5" /> Agregar
      </button>
    </div>

    <div class="relative mt-6 max-w-sm">
      <Search class="absolute left-3 top-2.5 size-4 text-slate-400" />
      <input v-model="q" :placeholder="`Buscar ${noun}`" class="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
    </div>

    <p v-if="error" class="mt-4 rounded-lg bg-rose-50 p-3 text-rose-700">{{ error }}</p>

    <div class="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead class="border-b border-slate-100 text-slate-500">
          <tr>
            <th v-for="c in columns" :key="c.key" class="px-4 py-3 font-medium">
              <button class="flex items-center gap-1 hover:text-slate-900" @click="sortBy(c)">
                {{ c.label }}
                <ArrowUpDown v-if="c.sortable !== false" :class="['size-3.5', sort.key === c.key ? 'text-indigo-600' : 'text-slate-300']" />
              </button>
            </th>
            <th class="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!loading && !visible.length">
            <td :colspan="columns.length + 1" class="px-4 py-10 text-center text-slate-500">
              {{ q ? 'No hay resultados para esa búsqueda.' : `Aún no hay ${plural}. Pulsa "Agregar" para crear el primero.` }}
            </td>
          </tr>
          <tr v-for="row in visible" :key="row.id" class="hover:bg-slate-50">
            <td v-for="c in columns" :key="c.key" class="max-w-xs truncate px-4 py-3">
              <template v-if="c.secret">
                <span class="font-mono">{{ revealed[row.id] ? row[c.key] || '—' : '••••••' }}</span>
                <button class="ml-2 align-middle text-slate-400 hover:text-slate-700" @click="revealed[row.id] = !revealed[row.id]">
                  <component :is="revealed[row.id] ? EyeOff : Eye" class="inline size-4" />
                </button>
              </template>
              <template v-else>{{ c.format ? c.format(row) : row[c.key] ?? '—' }}</template>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <button title="Editar" class="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100" @click="openEdit(row)"><Pencil class="size-4" /></button>
                <button title="Eliminar" class="grid size-9 place-items-center rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100" @click="remove(row)"><Trash2 class="size-4" /></button>
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

    <!-- Modal crear / editar -->
    <div v-if="showForm" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="showForm = false">
      <form class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" @submit.prevent="save">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">{{ editingId ? `Editar ${noun}` : `Nuevo ${noun}` }}</h2>
          <button type="button" aria-label="Cerrar" @click="showForm = false"><X class="size-5" /></button>
        </div>

        <p v-if="formError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ formError }}</p>

        <div class="grid gap-4 sm:grid-cols-2">
          <label v-for="f in fields" :key="f.key" :class="['block text-sm', f.wide ? 'sm:col-span-2' : '']">
            {{ f.label }}<span v-if="f.required" class="text-rose-500"> *</span>
            <textarea v-if="f.type === 'textarea'" v-model="form[f.key]" rows="3" :class="inputCls" />
            <select v-else-if="f.type === 'select'" v-model="form[f.key]" :class="inputCls">
              <option value="">{{ f.required ? 'Elige una opción' : 'Sin asignar' }}</option>
              <option v-for="o in opts[f.key] || []" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <PhoneInput v-else-if="f.type === 'phone'" v-model="form[f.key]" />
            <input v-else v-model="form[f.key]" :type="f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'" :min="f.type === 'number' ? 0 : undefined" :placeholder="f.placeholder" :class="inputCls" />
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100" @click="showForm = false">Cancelar</button>
          <button :disabled="saving" class="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>