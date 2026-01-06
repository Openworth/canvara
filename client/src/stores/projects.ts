import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useCanvasStore } from './canvas'
import { useImageStore } from './images'
import type { ExcalidrawElement, AppState } from '../types'

export interface Project {
  id: string
  name: string
  elements: ExcalidrawElement[]
  appState: AppState | null
  thumbnail: string | null
  createdAt: number
  updatedAt: number
}

export interface ProjectListItem {
  id: string
  name: string
  thumbnail: string | null
  createdAt: number
  updatedAt: number
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useProjectsStore = defineStore('projects', () => {
  const authStore = useAuthStore()
  const canvasStore = useCanvasStore()
  const imageStore = useImageStore()

  // State
  const projects = ref<ProjectListItem[]>([])
  const currentProjectId = ref<string | null>(null)
  const currentProjectName = ref<string>('Untitled')
  const isLoading = ref(false)
  const isSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const error = ref<string | null>(null)

  // Debounce timer for auto-save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  // Computed
  const currentProject = computed(() => {
    if (!currentProjectId.value) return null
    return projects.value.find(p => p.id === currentProjectId.value)
  })

  const isCloudProject = computed(() => !!currentProjectId.value)

  // Actions
  async function fetchProjects(): Promise<void> {
    if (!authStore.isPaidUser) return

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }

      const data = await response.json()
      projects.value = data.projects
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to fetch projects:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadProject(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to load project')
      }

      const data = await response.json()
      const project = data.project as Project

      // Preload any images in the project
      const imageFileIds = project.elements
        .filter(el => el.type === 'image' && el.fileId)
        .map(el => el.fileId!)
      if (imageFileIds.length > 0) {
        imageStore.preloadImages(imageFileIds)
      }

      // Load into canvas store
      canvasStore.setElements(project.elements)
      if (project.appState) {
        Object.assign(canvasStore.appState, project.appState)
      }

      currentProjectId.value = project.id
      currentProjectName.value = project.name
      lastSavedAt.value = project.updatedAt

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to load project:', e)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function createProject(name?: string): Promise<string | null> {
    if (!authStore.isPaidUser) return null

    isLoading.value = true
    error.value = null

    try {
      const elements = canvasStore.elements
      const appState = canvasStore.appState
      const thumbnail = await generateThumbnail()

      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({
          name: name || 'Untitled',
          elements,
          appState,
          thumbnail,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create project')
      }

      const data = await response.json()
      const project = data.project as Project

      // Add to projects list
      projects.value.unshift({
        id: project.id,
        name: project.name,
        thumbnail: project.thumbnail,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })

      currentProjectId.value = project.id
      currentProjectName.value = project.name
      lastSavedAt.value = project.updatedAt

      return project.id
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to create project:', e)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function saveProject(): Promise<boolean> {
    if (!authStore.isPaidUser || !currentProjectId.value) return false

    isSaving.value = true
    error.value = null

    try {
      const elements = canvasStore.elements
      const appState = canvasStore.appState
      const thumbnail = await generateThumbnail()

      const response = await fetch(`${API_URL}/api/projects/${currentProjectId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({
          name: currentProjectName.value,
          elements,
          appState,
          thumbnail,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save project')
      }

      const data = await response.json()
      lastSavedAt.value = data.project.updatedAt

      // Update in projects list
      const index = projects.value.findIndex(p => p.id === currentProjectId.value)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          name: currentProjectName.value,
          thumbnail: data.project.thumbnail,
          updatedAt: data.project.updatedAt,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to save project:', e)
      return false
    } finally {
      isSaving.value = false
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      // Remove from list
      projects.value = projects.value.filter(p => p.id !== projectId)

      // If this was the current project, clear it
      if (currentProjectId.value === projectId) {
        currentProjectId.value = null
        currentProjectName.value = 'Untitled'
        lastSavedAt.value = null
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to delete project:', e)
      return false
    }
  }

  async function duplicateProject(projectId: string): Promise<string | null> {
    if (!authStore.isPaidUser) return null

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate project')
      }

      const data = await response.json()
      const project = data.project as Project

      // Add to projects list
      projects.value.unshift({
        id: project.id,
        name: project.name,
        thumbnail: project.thumbnail,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })

      return project.id
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to duplicate project:', e)
      return null
    }
  }

  function renameProject(name: string) {
    currentProjectName.value = name
    debouncedSave()
  }

  function debouncedSave() {
    if (!currentProjectId.value || !authStore.isPaidUser) return

    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveProject()
    }, 2000) // 2 second debounce
  }

  // Create new empty project (clears canvas)
  function newProject() {
    currentProjectId.value = null
    currentProjectName.value = 'Untitled'
    lastSavedAt.value = null
    canvasStore.clearCanvas()
  }

  // Generate thumbnail from canvas
  async function generateThumbnail(): Promise<string | null> {
    // Simple approach: return null for now, can be implemented with canvas export later
    return null
  }

  // Watch for changes and auto-save if we have a current project
  watch(
    () => canvasStore.elements,
    () => {
      if (currentProjectId.value && authStore.isPaidUser) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  return {
    // State
    projects,
    currentProjectId,
    currentProjectName,
    isLoading,
    isSaving,
    lastSavedAt,
    error,

    // Computed
    currentProject,
    isCloudProject,

    // Actions
    fetchProjects,
    loadProject,
    createProject,
    saveProject,
    deleteProject,
    duplicateProject,
    renameProject,
    newProject,
    debouncedSave,
  }
})

