import { ref } from 'vue'

const dark = ref(false)

const apply = () => document.documentElement.classList.toggle('dark', dark.value)

export function initTheme() {
  const saved = localStorage.getItem('theme')
  dark.value = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  apply()
}

export function useTheme() {
  const toggle = () => {
    dark.value = !dark.value
    localStorage.setItem('theme', dark.value ? 'dark' : 'light')
    apply()
  }
  return { dark, toggle }
}