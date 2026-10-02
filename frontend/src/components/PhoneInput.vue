<script setup>
import { ref, computed, watch } from 'vue'
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const names = new Intl.DisplayNames(['es'], { type: 'region' })
const countries = getCountries()
  .map((code) => ({ code, name: names.of(code), dial: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

const country = ref('CO')
const text = ref('')

// Al editar, separa el número guardado en país + número
if (props.modelValue) {
  const p = parsePhoneNumberFromString(props.modelValue)
  if (p?.country) {
    country.value = p.country
    text.value = p.formatNational()
  } else {
    text.value = props.modelValue
  }
}

const parsed = computed(() => (text.value ? parsePhoneNumberFromString(text.value, country.value) : null))
const valid = computed(() => !!parsed.value?.isValid())

// Emite el número internacional solo si es válido; si no, vacío
watch([parsed, valid], () => emit('update:modelValue', valid.value ? parsed.value.number : ''))

function onInput(e) {
  const raw = e.target.value
  const typer = new AsYouType(country.value)
  const out = typer.input(raw)
  if (raw.trim().startsWith('+') && typer.getCountry()) country.value = typer.getCountry()
  text.value = out
  e.target.value = out
}

function onCountry() {
  text.value = new AsYouType(country.value).input(text.value)
}
</script>

<template>
  <div>
    <div class="mt-1 flex gap-2">
      <select v-model="country" class="w-44 max-w-[50%] shrink-0 rounded-lg border border-slate-300 px-2 py-2" @change="onCountry">
        <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.name }} (+{{ c.dial }})</option>
      </select>
      <input :value="text" inputmode="tel" autocomplete="tel" placeholder="Número"
        class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" @input="onInput" />
    </div>
    <p v-if="text && !valid" class="mt-1 text-xs text-rose-600">Número no válido para {{ names.of(country) }}</p>
  </div>
</template>