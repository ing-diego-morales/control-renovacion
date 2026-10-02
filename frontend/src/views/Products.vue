<script setup>
import CrudView from '../components/CrudView.vue'
import { api } from '../api'
import { money } from '../utils'

const columns = [
  { key: 'name', label: 'Producto' },
  { key: 'category_name', label: 'Categoría', format: (r) => r.category_name || 'Sin categoría' },
  { key: 'price', label: 'Precio', format: (r) => money.format(r.price) },
  { key: 'duration_days', label: 'Duración', format: (r) => `${r.duration_days} días` },
]
const fields = [
  { key: 'name', label: 'Producto', required: true, placeholder: 'Netflix, Prime Video…' },
  {
    key: 'category_id', label: 'Categoría', type: 'select',
    optionsFrom: async () => (await api.get('/categories')).map((c) => ({ value: c.id, label: c.name })),
  },
  { key: 'price', label: 'Precio de venta', type: 'number' },
  { key: 'duration_days', label: 'Duración (días)', type: 'number', default: 30 },
]
</script>

<template>
  <CrudView title="Productos" endpoint="/products" noun="producto" plural="productos" :columns="columns" :fields="fields" />
</template>