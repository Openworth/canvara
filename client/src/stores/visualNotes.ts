import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExcalidrawElement } from '../types'
import { useAuthStore } from './auth'

// Get API base URL
function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    return apiUrl
  }
  // Development: use same host
  return `${window.location.protocol}//${window.location.host}`
}

interface VisualizeResponse {
  elements: ExcalidrawElement[]
  suggestedProjectName: string
  remainingUses?: number
  dailyLimit?: number
}

interface VisualizeResult {
  elements: ExcalidrawElement[]
  suggestedProjectName: string
}

interface VisualizeError {
  error: string
  remainingUses?: number
  dailyLimit?: number
}

export const useVisualNotesStore = defineStore('visualNotes', () => {
  // State
  const isProcessing = ref(false)
  const error = ref<string | null>(null)
  const remainingUses = ref<number | null>(null)
  const dailyLimit = ref<number>(3)

  // Reset error
  function clearError() {
    error.value = null
  }

  // Check if dark mode is active
  function isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark')
  }

  // Visualize from a file (image or PDF)
  async function visualizeFile(file: File, expandContent: boolean = false): Promise<VisualizeResult | null> {
    isProcessing.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('theme', isDarkMode() ? 'dark' : 'light')
      formData.append('expandContent', String(expandContent))

      const response = await fetch(`${getApiUrl()}/api/visualize`, {
        method: 'POST',
        headers: authStore.getAuthHeaders(),
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData: VisualizeError = await response.json()
        // Update remaining uses from error response
        if (errorData.remainingUses !== undefined) {
          remainingUses.value = errorData.remainingUses
        }
        if (errorData.dailyLimit !== undefined) {
          dailyLimit.value = errorData.dailyLimit
        }
        throw new Error(errorData.error || 'Failed to visualize content')
      }

      const data: VisualizeResponse = await response.json()
      // Update remaining uses from success response
      if (data.remainingUses !== undefined) {
        remainingUses.value = data.remainingUses
      }
      if (data.dailyLimit !== undefined) {
        dailyLimit.value = data.dailyLimit
      }
      return {
        elements: data.elements,
        suggestedProjectName: data.suggestedProjectName,
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // Visualize from text content
  async function visualizeText(text: string, expandContent: boolean = false): Promise<VisualizeResult | null> {
    if (!text.trim()) {
      error.value = 'Please provide some text content'
      return null
    }

    isProcessing.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const response = await fetch(`${getApiUrl()}/api/visualize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authStore.getAuthHeaders(),
        },
        body: JSON.stringify({ 
          text, 
          theme: isDarkMode() ? 'dark' : 'light',
          expandContent,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData: VisualizeError = await response.json()
        // Update remaining uses from error response
        if (errorData.remainingUses !== undefined) {
          remainingUses.value = errorData.remainingUses
        }
        if (errorData.dailyLimit !== undefined) {
          dailyLimit.value = errorData.dailyLimit
        }
        throw new Error(errorData.error || 'Failed to visualize content')
      }

      const data: VisualizeResponse = await response.json()
      // Update remaining uses from success response
      if (data.remainingUses !== undefined) {
        remainingUses.value = data.remainingUses
      }
      if (data.dailyLimit !== undefined) {
        dailyLimit.value = data.dailyLimit
      }
      return {
        elements: data.elements,
        suggestedProjectName: data.suggestedProjectName,
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // Fetch remaining uses without generating (for initial modal state)
  async function fetchRemainingUses(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return
    
    // Pro users don't need to track uses
    if (authStore.isPaidUser) {
      remainingUses.value = null
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/visualize/usage`, {
        method: 'GET',
        headers: authStore.getAuthHeaders(),
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json() as { remainingUses: number; dailyLimit: number }
        remainingUses.value = data.remainingUses
        dailyLimit.value = data.dailyLimit
      }
    } catch {
      // Silently fail - we'll get the usage info when they try to generate
    }
  }

  return {
    // State
    isProcessing,
    error,
    remainingUses,
    dailyLimit,

    // Actions
    clearError,
    visualizeFile,
    visualizeText,
    fetchRemainingUses,
  }
})

