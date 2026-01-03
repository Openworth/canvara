<script setup lang="ts">
import { useAppStore } from './stores/app'
import { useCanvasStore } from './stores/canvas'
import { onMounted, watch } from 'vue'
import Tooltip from './components/ui/Tooltip.vue'

const appStore = useAppStore()
const canvasStore = useCanvasStore()

// Track if initial theme has been set (to avoid inverting colors on load)
let hasInitializedTheme = false

// Handle dark mode
onMounted(() => {
  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const savedTheme = localStorage.getItem('canvara-theme')
  
  if (savedTheme) {
    const isDark = savedTheme === 'dark'
    appStore.setDarkMode(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    canvasStore.setThemeMode(isDark)
  } else {
    appStore.setDarkMode(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
    canvasStore.setThemeMode(prefersDark)
  }
  
  // Mark initialization complete after a tick to let the watcher fire first
  setTimeout(() => { hasInitializedTheme = true }, 0)
})

watch(() => appStore.isDarkMode, (isDark) => {
  document.documentElement.classList.toggle('dark', isDark)
  localStorage.setItem('canvara-theme', isDark ? 'dark' : 'light')
  
  // Invert element colors when theme changes (not on initial load)
  if (hasInitializedTheme) {
    canvasStore.invertElementColors()
    canvasStore.setThemeMode(isDark)
  }
})
</script>

<template>
  <router-view />
  <Tooltip />
</template>
