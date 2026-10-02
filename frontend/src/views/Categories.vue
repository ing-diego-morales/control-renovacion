<script setup>
import CrudView from '../components/CrudView.vue'

const columns = [{ key: 'name', label: 'Categoría' }]
const fields = [{ key: 'name', label: 'Nombre de la categoría', required: true, wide: true, placeholder: 'Video, Música, Educación…' }]
</script>

<template>
  <CrudView title="Categorías" endpoint="/categories" noun="categoría" plural="categorías" :columns="columns" :fields="fields" />
</template>