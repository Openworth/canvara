import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import type { Tag } from '../../../shared/types'
import { TAG_COLORS } from '../../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useTagsStore = defineStore('tags', () => {
  const authStore = useAuthStore()

  // State
  const tags = ref<Tag[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const sortedTags = computed(() => {
    return [...tags.value].sort((a, b) => a.name.localeCompare(b.name))
  })

  const tagById = computed(() => {
    return (id: string) => tags.value.find(t => t.id === id)
  })

  const tagColors = computed(() => TAG_COLORS)

  // Actions
  async function fetchTags(): Promise<void> {
    if (!authStore.isPaidUser) return

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/tags`, {
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }

      const data = await response.json()
      tags.value = data.tags
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to fetch tags:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createTag(name: string, color?: string): Promise<Tag | null> {
    if (!authStore.isPaidUser) return null

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ name, color: color || TAG_COLORS[0] }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create tag')
      }

      const data = await response.json()
      const tag = data.tag as Tag
      tags.value.push(tag)
      return tag
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to create tag:', e)
      return null
    }
  }

  async function updateTag(tagId: string, updates: { name?: string; color?: string }): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update tag')
      }

      const data = await response.json()
      const updatedTag = data.tag as Tag

      // Update in local state
      const index = tags.value.findIndex(t => t.id === tagId)
      if (index !== -1) {
        tags.value[index] = updatedTag
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to update tag:', e)
      return false
    }
  }

  async function deleteTag(tagId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/tags/${tagId}`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete tag')
      }

      // Remove from local state
      tags.value = tags.value.filter(t => t.id !== tagId)
      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to delete tag:', e)
      return false
    }
  }

  function reset() {
    tags.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    tags,
    isLoading,
    error,

    // Computed
    sortedTags,
    tagById,
    tagColors,

    // Actions
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    reset,
  }
})

