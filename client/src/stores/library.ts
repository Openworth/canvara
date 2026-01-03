import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from 'nanoid'
import type { ExcalidrawElement, LibraryItem } from '../types'

const LIBRARY_STORAGE_KEY = 'canvara-library'

export const useLibraryStore = defineStore('library', () => {
  const items = ref<LibraryItem[]>([])
  const isOpen = ref(false)

  // Load library from localStorage
  function loadLibrary() {
    try {
      const saved = localStorage.getItem(LIBRARY_STORAGE_KEY)
      if (saved) {
        items.value = JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load library:', e)
    }
  }

  // Save library to localStorage
  function saveLibrary() {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items.value))
    } catch (e) {
      console.error('Failed to save library:', e)
    }
  }

  // Add elements to library
  function addToLibrary(elements: ExcalidrawElement[]) {
    if (elements.length === 0) return

    // Clone elements and normalize positions
    const minX = Math.min(...elements.map(el => el.x))
    const minY = Math.min(...elements.map(el => el.y))

    const normalizedElements = elements.map(el => ({
      ...el,
      id: nanoid(),
      x: el.x - minX,
      y: el.y - minY,
    }))

    const item: LibraryItem = {
      id: nanoid(),
      status: 'unpublished',
      elements: normalizedElements,
      createdAt: Date.now(),
    }

    items.value = [...items.value, item]
    saveLibrary()
  }

  // Remove item from library
  function removeFromLibrary(id: string) {
    items.value = items.value.filter(item => item.id !== id)
    saveLibrary()
  }

  // Get elements from library item
  function getItemElements(id: string): ExcalidrawElement[] | null {
    const item = items.value.find(i => i.id === id)
    if (!item) return null

    // Return copies with new IDs
    return item.elements.map(el => ({
      ...el,
      id: nanoid(),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
    }))
  }

  // Toggle library panel
  function toggleLibrary() {
    isOpen.value = !isOpen.value
  }

  function openLibrary() {
    isOpen.value = true
  }

  function closeLibrary() {
    isOpen.value = false
  }

  // Export library
  function exportLibrary(): string {
    return JSON.stringify({
      type: 'canvara-library',
      version: 1,
      items: items.value,
    }, null, 2)
  }

  // Import library
  function importLibrary(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString)
      if (data.type !== 'canvara-library') {
        throw new Error('Invalid library format')
      }

      // Merge with existing items (avoid duplicates)
      const existingIds = new Set(items.value.map(i => i.id))
      const newItems = data.items.filter((item: LibraryItem) => !existingIds.has(item.id))
      
      items.value = [...items.value, ...newItems]
      saveLibrary()
      return true
    } catch (e) {
      console.error('Failed to import library:', e)
      return false
    }
  }

  // Clear library
  function clearLibrary() {
    items.value = []
    saveLibrary()
  }

  // Initialize
  loadLibrary()

  return {
    items,
    isOpen,
    addToLibrary,
    removeFromLibrary,
    getItemElements,
    toggleLibrary,
    openLibrary,
    closeLibrary,
    exportLibrary,
    importLibrary,
    clearLibrary,
  }
})

