<script setup>
import CrudView from '../components/CrudView.vue'
import { formatPhone } from '../utils'

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'phone', label: 'Teléfono', format: (r) => formatPhone(r.phone) },
  { key: 'email', label: 'Correo' },
  { key: 'notes', label: 'Notas' },
]
const fields = [
  { key: 'name', label: 'Nombre', required: true },
  { key: 'email', label: 'Correo', type: 'email', required: true, placeholder: 'cliente@correo.com' },
  { key: 'phone', label: 'Teléfono (WhatsApp)', type: 'phone', required: true, wide: true },
  { key: 'notes', label: 'Notas', type: 'textarea', wide: true },
]
</script>

<template>
  <CrudView title="Clientes" endpoint="/customers" noun="cliente" plural="clientes" :columns="columns" :fields="fields" />
</template>