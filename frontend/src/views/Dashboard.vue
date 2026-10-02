<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import {
  MessageCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Wallet,
  KeyRound,
  ChevronDown,
} from "lucide-vue-next";
import { api } from "../api";
import { money, whatsappUrl } from "../utils";

const data = ref(null);
const error = ref("");
const loading = ref(true);

onMounted(async () => {
  try {
    data.value = await api.get("/dashboard");
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

const totalFree = computed(() =>
  (data.value?.free ?? []).reduce((s, r) => s + Number(r.total), 0),
);

// Agrupa las cuentas libres por categoría y, dentro, por servicio
const byCategory = computed(() => {
  const map = new Map();
  for (const r of data.value?.free ?? []) {
    if (!map.has(r.category_name))
      map.set(r.category_name, {
        name: r.category_name,
        products: [],
        total: 0,
      });
    const g = map.get(r.category_name);
    g.products.push(r);
    g.total += Number(r.total);
  }
  return [...map.values()];
});

const whenLabel = (d) =>
  d < 0
    ? `Venció hace ${-d} ${-d === 1 ? "día" : "días"}`
    : d === 0
      ? "Vence hoy"
      : `Vence en ${d} ${d === 1 ? "día" : "días"}`;

const badge = (d) =>
  d < 0
    ? "bg-rose-100 text-rose-700"
    : d <= 3
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-600";
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">Panel</h1>
    <p class="text-slate-500">Lo que necesita tu atención hoy.</p>

    <p v-if="error" class="mt-6 rounded-lg bg-rose-50 p-4 text-rose-700">
      {{ error }}
    </p>
    <p v-else-if="loading" class="mt-6 text-slate-500">Cargando…</p>

    <template v-else>
      <!-- Indicadores (los tres primeros abren Alquileres filtrado) -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink
          :to="{ path: '/alquileres', query: { state: 'expired' } }"
          class="rounded-xl border-l-4 border-rose-500 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <AlertTriangle class="size-4 text-rose-500" />Vencidos sin cortar
          </div>
          <p class="mt-2 text-3xl font-semibold">{{ data.stats.expired }}</p>
          <p class="mt-1 text-xs text-slate-400">Toca para ver cuáles son</p>
        </RouterLink>

        <RouterLink
          :to="{ path: '/alquileres', query: { state: 'expiring' } }"
          class="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <Clock class="size-4 text-amber-500" />Vencen en 3 días
          </div>
          <p class="mt-2 text-3xl font-semibold">{{ data.stats.expiring }}</p>
          <p class="mt-1 text-xs text-slate-400">Toca para ver cuáles son</p>
        </RouterLink>

        <RouterLink
          :to="{ path: '/alquileres', query: { state: 'active' } }"
          class="rounded-xl border-l-4 border-emerald-500 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 class="size-4 text-emerald-500" />Alquileres al día
          </div>
          <p class="mt-2 text-3xl font-semibold">
            {{ data.stats.active_rentals }}
          </p>
          <p class="mt-1 text-xs text-slate-400">Toca para ver cuáles son</p>
        </RouterLink>

        <div
          class="rounded-xl border-l-4 border-indigo-500 bg-white p-5 shadow-sm"
        >
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <Wallet class="size-4 text-indigo-500" />Ingreso del ciclo
          </div>
          <p class="mt-2 text-3xl font-semibold">
            {{ money.format(data.stats.monthly_income) }}
          </p>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-5">
        <!-- Para renovar o cortar -->
        <section class="rounded-xl bg-white p-5 shadow-sm lg:col-span-3">
          <h2 class="font-semibold">Para renovar o cortar</h2>
          <p class="text-sm text-slate-500">
            Vencidos y próximos 7 días, del más urgente al menos.
          </p>

          <p v-if="!data.due.length" class="mt-4 text-slate-500">
            Nada pendiente por ahora.
          </p>
          <ul v-else class="mt-4 divide-y divide-slate-100">
            <li
              v-for="r in data.due"
              :key="r.id"
              class="flex items-center gap-3 py-3"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ r.customer_name }}</p>
                <p class="truncate text-sm text-slate-500">
                  {{ r.product_name }} · {{ r.account_email }}
                </p>
              </div>
              <span
                :class="[
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  badge(r.days_left),
                ]"
                >{{ whenLabel(r.days_left) }}</span
              >
              <a
                :href="whatsappUrl(r)"
                target="_blank"
                rel="noopener"
                aria-label="Enviar WhatsApp"
                class="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
              >
                <MessageCircle class="size-5" />
              </a>
            </li>
          </ul>
        </section>

        <!-- Cuentas libres -->
        <section class="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <div class="flex items-center gap-2">
            <KeyRound class="size-5 text-emerald-600" />
            <h2 class="font-semibold">Cuentas libres</h2>
          </div>
          <p class="mt-3 text-3xl font-semibold">
            {{ totalFree }}
            <span class="text-base font-normal text-slate-500">{{
              totalFree === 1 ? "cuenta disponible" : "cuentas disponibles"
            }}</span>
          </p>

          <p v-if="!byCategory.length" class="mt-4 text-slate-500">
            No tienes cuentas libres.
          </p>
          <div v-else class="mt-4 space-y-2">
            <details
              v-for="g in byCategory"
              :key="g.name"
              class="group rounded-lg border border-slate-200"
            >
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5"
              >
                <span class="font-medium">{{ g.name }}</span>
                <span class="flex items-center gap-2 text-sm text-slate-500">
                  {{ g.total }} {{ g.total === 1 ? "cuenta" : "cuentas" }}
                  <ChevronDown
                    class="size-4 transition group-open:rotate-180"
                  />
                </span>
              </summary>
              <ul
                class="divide-y divide-slate-100 border-t border-slate-100 px-3"
              >
                <li v-for="p in g.products" :key="p.product_id">
                  <RouterLink
                    :to="{
                      path: '/cuentas',
                      query: { state: 'free', product_id: p.product_id },
                    }"
                    class="flex items-center justify-between gap-3 py-2.5 hover:text-emerald-600"
                  >
                    <span class="text-sm font-medium">{{
                      p.product_name
                    }}</span>
                    <span
                      class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      >{{ p.total }} libres</span
                    >
                  </RouterLink>
                </li>
              </ul>
            </details>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
