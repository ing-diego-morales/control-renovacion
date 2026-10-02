<script setup>
import { ref, computed } from "vue";
import { RouterView, useRoute } from "vue-router";
import Sidebar from "./components/Sidebar.vue";
import Navbar from "./components/Navbar.vue";
import Footer from "./components/Footer.vue";
import ExpiredAlert from "./components/ExpiredAlert.vue";

const route = useRoute();
const open = ref(false);
const collapsed = ref(localStorage.getItem("sidebar") === "closed");
const isPublic = computed(() => !!route.meta.public);

function toggleMenu() {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    collapsed.value = !collapsed.value;
    localStorage.setItem("sidebar", collapsed.value ? "closed" : "open");
  } else {
    open.value = !open.value;
  }
}
</script>

<template>
  <RouterView v-if="isPublic" />

  <div
    v-else
    :class="[
      'flex min-h-screen flex-col transition-[padding] duration-200',
      collapsed ? '' : 'lg:pl-64',
    ]"
  >
    <Sidebar :open="open" :collapsed="collapsed" @close="open = false" />
    <Navbar @menu="toggleMenu" />
    <main class="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-8">
      <RouterView />
    </main>
    <Footer />
    <ExpiredAlert />
  </div>
</template>
