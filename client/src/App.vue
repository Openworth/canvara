<script setup lang="ts">
import { useAppStore } from './stores/app'
import { useCanvasStore } from './stores/canvas'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'
import { onMounted, watch } from 'vue'
import Tooltip from './components/ui/Tooltip.vue'
import ToastContainer from './components/ui/ToastContainer.vue'

const appStore = useAppStore()
const canvasStore = useCanvasStore()
const authStore = useAuthStore()
const toastStore = useToastStore()

// Track if initial theme has been set (to avoid inverting colors on load)
let hasInitializedTheme = false

// Handle dark mode and auth
onMounted(async () => {
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

  // Check auth status on load
  await authStore.checkAuth()

  // Handle OAuth callback
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('auth') === 'success') {
    // Clear the URL params
    window.history.replaceState({}, document.title, window.location.pathname)
    // Refresh user data
    await authStore.checkAuth()
  } else if (urlParams.get('error')) {
    console.error('Auth error:', urlParams.get('error'))
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  // Handle Stripe checkout callbacks
  if (urlParams.get('checkout') === 'success') {
    window.history.replaceState({}, document.title, window.location.pathname)
    // Refresh user data to get updated subscription status
    await authStore.checkAuth()
    toastStore.success('Welcome to Pro! Your subscription is now active.')
  } else if (urlParams.get('checkout') === 'canceled') {
    window.history.replaceState({}, document.title, window.location.pathname)
    toastStore.info('Checkout canceled. No charges were made.')
  }
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
  <ToastContainer />
</template>
