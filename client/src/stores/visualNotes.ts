import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExcalidrawElement } from '../types'

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
}

interface VisualizeError {
  error: string
}

export const useVisualNotesStore = defineStore('visualNotes', () => {
  // State
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  // Reset error
  function clearError() {
    error.value = null
  }

  // Check if dark mode is active
  function isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark')
  }

  // Visualize from a file (image or PDF)
  async function visualizeFile(file: File, expandContent: boolean = false): Promise<ExcalidrawElement[] | null> {
    isProcessing.value = true
    error.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('theme', isDarkMode() ? 'dark' : 'light')
      formData.append('expandContent', String(expandContent))

      const response = await fetch(`${getApiUrl()}/api/visualize`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData: VisualizeError = await response.json()
        throw new Error(errorData.error || 'Failed to visualize content')
      }

      const data: VisualizeResponse = await response.json()
      return data.elements
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // Visualize from text content
  async function visualizeText(text: string, expandContent: boolean = false): Promise<ExcalidrawElement[] | null> {
    if (!text.trim()) {
      error.value = 'Please provide some text content'
      return null
    }

    isProcessing.value = true
    error.value = null

    try {
      const response = await fetch(`${getApiUrl()}/api/visualize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(errorData.error || 'Failed to visualize content')
      }

      const data: VisualizeResponse = await response.json()
      return data.elements
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
      return null
    } finally {
      isProcessing.value = false
    }
  }

  return {
    // State
    isProcessing,
    error,

    // Actions
    clearError,
    visualizeFile,
    visualizeText,
  }
})

