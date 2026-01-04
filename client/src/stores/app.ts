import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isDarkMode = ref(false)
  const isLoading = ref(false)
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const showExportModal = ref(false)
  const showMobilePropertiesPanel = ref(false)

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

  function openExportModal() {
    showExportModal.value = true
  }

  function closeExportModal() {
    showExportModal.value = false
  }

  function setMobilePropertiesPanel(value: boolean) {
    showMobilePropertiesPanel.value = value
  }

  return {
    isDarkMode,
    isLoading,
    connectionStatus,
    showExportModal,
    showMobilePropertiesPanel,
    setDarkMode,
    toggleDarkMode,
    setLoading,
    setConnectionStatus,
    openExportModal,
    closeExportModal,
    setMobilePropertiesPanel,
  }
})

