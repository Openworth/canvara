import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import type { Folder } from '../../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useFoldersStore = defineStore('folders', () => {
  const authStore = useAuthStore()

  // State
  const folders = ref<Folder[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const sortedFolders = computed(() => {
    return [...folders.value].sort((a, b) => a.sortOrder - b.sortOrder)
  })

  const folderById = computed(() => {
    return (id: string) => folders.value.find(f => f.id === id)
  })

  // Actions
  async function fetchFolders(): Promise<void> {
    if (!authStore.isPaidUser) return

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/folders`, {
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch folders')
      }

      const data = await response.json()
      folders.value = data.folders
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to fetch folders:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createFolder(name?: string, color?: string): Promise<Folder | null> {
    if (!authStore.isPaidUser) return null

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ name, color }),
      })

      if (!response.ok) {
        throw new Error('Failed to create folder')
      }

      const data = await response.json()
      const folder = data.folder as Folder
      folders.value.push(folder)
      return folder
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to create folder:', e)
      return null
    }
  }

  async function updateFolder(
    folderId: string,
    updates: { name?: string; color?: string; sortOrder?: number }
  ): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update folder')
      }

      const data = await response.json()
      const updatedFolder = data.folder as Folder

      // Update in local state
      const index = folders.value.findIndex(f => f.id === folderId)
      if (index !== -1) {
        folders.value[index] = updatedFolder
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to update folder:', e)
      return false
    }
  }

  async function deleteFolder(folderId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete folder')
      }

      // Remove from local state
      folders.value = folders.value.filter(f => f.id !== folderId)
      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to delete folder:', e)
      return false
    }
  }

  async function reorderFolders(folderIds: string[]): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    error.value = null

    // Optimistically update local state
    const newFolders = folderIds.map((id, index) => {
      const folder = folders.value.find(f => f.id === id)
      if (folder) {
        return { ...folder, sortOrder: index }
      }
      return null
    }).filter(Boolean) as Folder[]

    folders.value = newFolders

    try {
      const response = await fetch(`${API_URL}/api/folders/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ folderIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to reorder folders')
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to reorder folders:', e)
      // Refetch to restore correct order
      await fetchFolders()
      return false
    }
  }

  function reset() {
    folders.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    folders,
    isLoading,
    error,

    // Computed
    sortedFolders,
    folderById,

    // Actions
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
    reset,
  }
})

