import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isDarkMode = ref(false)
  const isLoading = ref(false)
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')

  function setDarkMode(value: boolean) {
    isDarkMode.value = value
  }

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
  }

  function setLoading(value: boolean) {
    isLoading.value = value
  }

  function setConnectionStatus(status: 'disconnected' | 'connecting' | 'connected') {
    connectionStatus.value = status
  }

  return {
    isDarkMode,
    isLoading,
    connectionStatus,
    setDarkMode,
    toggleDarkMode,
    setLoading,
    setConnectionStatus,
  }
})

