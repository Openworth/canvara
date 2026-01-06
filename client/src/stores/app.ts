import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth'

export const useAppStore = defineStore('app', () => {
  const isDarkMode = ref(false)
  const isLoading = ref(false)
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const showExportModal = ref(false)
  const showMobilePropertiesPanel = ref(false)
  const showVisualNotesModal = ref(false)
  const showUpgradeModal = ref(false)

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

  function openVisualNotesModal() {
    const authStore = useAuthStore()
    if (!authStore.isPaidUser) {
      showUpgradeModal.value = true
      return
    }
    showVisualNotesModal.value = true
  }

  function closeVisualNotesModal() {
    showVisualNotesModal.value = false
  }

  function openUpgradeModal() {
    showUpgradeModal.value = true
  }

  function closeUpgradeModal() {
    showUpgradeModal.value = false
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
    showVisualNotesModal,
    showUpgradeModal,
    setDarkMode,
    toggleDarkMode,
    setLoading,
    setConnectionStatus,
    openExportModal,
    closeExportModal,
    openVisualNotesModal,
    closeVisualNotesModal,
    openUpgradeModal,
    closeUpgradeModal,
    setMobilePropertiesPanel,
  }
})

