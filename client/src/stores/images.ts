import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Get API base URL
function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    return apiUrl
  }
  // Development: use same host
  return `${window.location.protocol}//${window.location.host}`
}

interface ImageCacheEntry {
  image: HTMLImageElement
  status: 'loading' | 'loaded' | 'error'
  url: string
}

interface UploadResult {
  fileId: string
  url: string
  mimeType: string
  size: number
}

export const useImageStore = defineStore('images', () => {
  // Image cache: fileId -> cache entry
  const cache = ref<Map<string, ImageCacheEntry>>(new Map())
  
  // Loading promises to avoid duplicate requests
  const loadingPromises = new Map<string, Promise<HTMLImageElement | null>>()

  // Computed: get all loaded images
  const loadedImages = computed(() => {
    const loaded: Map<string, HTMLImageElement> = new Map()
    cache.value.forEach((entry, fileId) => {
      if (entry.status === 'loaded') {
        loaded.set(fileId, entry.image)
      }
    })
    return loaded
  })

  // Upload an image file to the server
  async function uploadImage(file: File): Promise<UploadResult | null> {
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`${getApiUrl()}/api/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Upload failed:', error)
        return null
      }

      const result: UploadResult = await response.json()
      
      // Preload the image into cache
      await loadImage(result.fileId, result.url)
      
      return result
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  // Load an image from URL and cache it
  async function loadImage(fileId: string, url?: string): Promise<HTMLImageElement | null> {
    // Check if already cached
    const existing = cache.value.get(fileId)
    if (existing && existing.status === 'loaded') {
      return existing.image
    }

    // Check if already loading
    const existingPromise = loadingPromises.get(fileId)
    if (existingPromise) {
      return existingPromise
    }

    // Construct URL if not provided
    const imageUrl = url || `${getApiUrl()}/api/images/${fileId}`

    // Create loading entry
    cache.value.set(fileId, {
      image: new Image(),
      status: 'loading',
      url: imageUrl,
    })
    cache.value = new Map(cache.value) // Trigger reactivity

    // Create loading promise
    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // Enable CORS for canvas operations
      
      img.onload = () => {
        cache.value.set(fileId, {
          image: img,
          status: 'loaded',
          url: imageUrl,
        })
        cache.value = new Map(cache.value) // Trigger reactivity
        loadingPromises.delete(fileId)
        resolve(img)
      }

      img.onerror = () => {
        cache.value.set(fileId, {
          image: img,
          status: 'error',
          url: imageUrl,
        })
        cache.value = new Map(cache.value) // Trigger reactivity
        loadingPromises.delete(fileId)
        resolve(null)
      }

      img.src = imageUrl
    })

    loadingPromises.set(fileId, promise)
    return promise
  }

  // Get an image from cache (returns immediately, may be null if not loaded)
  function getImage(fileId: string): HTMLImageElement | null {
    const entry = cache.value.get(fileId)
    if (entry && entry.status === 'loaded') {
      return entry.image
    }
    
    // Start loading if not in cache
    if (!entry && !loadingPromises.has(fileId)) {
      loadImage(fileId)
    }
    
    return null
  }

  // Get image status
  function getImageStatus(fileId: string): 'loading' | 'loaded' | 'error' | 'none' {
    const entry = cache.value.get(fileId)
    return entry?.status || 'none'
  }

  // Preload multiple images (for collaboration sync)
  async function preloadImages(fileIds: string[]): Promise<void> {
    const promises = fileIds
      .filter(id => !cache.value.has(id))
      .map(id => loadImage(id))
    
    await Promise.all(promises)
  }

  // Get image dimensions from a file (for creating elements)
  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ width: 200, height: 200 }) // Default fallback
      }

      img.src = url
    })
  }

  // Clear cache (for memory management)
  function clearCache() {
    cache.value = new Map()
    loadingPromises.clear()
  }

  return {
    // State
    cache,
    
    // Computed
    loadedImages,
    
    // Actions
    uploadImage,
    loadImage,
    getImage,
    getImageStatus,
    preloadImages,
    getImageDimensions,
    clearCache,
  }
})

