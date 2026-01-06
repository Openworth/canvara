import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { useAppStore } from './app'
import { useCanvasStore } from './canvas'
import { useImageStore } from './images'
import type { ExcalidrawElement, AppState, Tag, ProjectSortField, ProjectView, ViewMode } from '../types'
import type { ProjectListItem as SharedProjectListItem } from '../../../shared/types'
import rough from 'roughjs'

export interface Project {
  id: string
  name: string
  elements: ExcalidrawElement[]
  appState: AppState | null
  thumbnail: string | null
  folderId: string | null
  isStarred: boolean
  isArchived: boolean
  isTrashed: boolean
  trashedAt: number | null
  tags: Tag[]
  createdAt: number
  updatedAt: number
}

export type ProjectListItem = SharedProjectListItem

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Helper to determine if a color is dark (for theme detection)
function isColorDark(color: string): boolean {
  // Handle common dark background colors
  const darkColors = ['#121212', '#1e1e1e', '#000000', '#000', 'black', '#0a0a0a', '#171717']
  const lowerColor = color.toLowerCase()
  
  if (darkColors.includes(lowerColor)) return true
  
  // Parse hex color and calculate luminance
  let hex = color.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  
  if (hex.length !== 6) return false // Default to light if can't parse
  
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  return luminance < 0.5
}

export const useProjectsStore = defineStore('projects', () => {
  const authStore = useAuthStore()
  const appStore = useAppStore()
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

  // View/Filter State
  const currentView = ref<ProjectView>('all')
  const currentFolderId = ref<string | null>(null)
  const searchQuery = ref('')
  const selectedTagIds = ref<string[]>([])
  const sortField = ref<ProjectSortField>('updatedAt')
  const sortOrder = ref<'asc' | 'desc'>('desc')
  const viewMode = ref<ViewMode>('grid')

  // Debounce timer for auto-save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  // Computed
  const currentProject = computed(() => {
    if (!currentProjectId.value) return null
    return projects.value.find(p => p.id === currentProjectId.value)
  })

  const isCloudProject = computed(() => !!currentProjectId.value)

  // Filtered and sorted projects based on current view and filters
  const filteredProjects = computed(() => {
    let result = [...projects.value]

    // Filter by view type
    switch (currentView.value) {
      case 'starred':
        result = result.filter(p => p.isStarred && !p.isTrashed && !p.isArchived)
        break
      case 'archived':
        result = result.filter(p => p.isArchived && !p.isTrashed)
        break
      case 'trashed':
        result = result.filter(p => p.isTrashed)
        break
      case 'recent':
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
        result = result.filter(p => p.updatedAt >= sevenDaysAgo && !p.isTrashed && !p.isArchived)
        break
      case 'folder':
        result = result.filter(p => {
          if (currentFolderId.value === null) {
            return p.folderId === null && !p.isTrashed && !p.isArchived
          }
          return p.folderId === currentFolderId.value && !p.isTrashed && !p.isArchived
        })
        break
      case 'all':
      default:
        result = result.filter(p => !p.isTrashed && !p.isArchived)
        break
    }

    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      result = result.filter(p => p.name.toLowerCase().includes(query))
    }

    // Filter by tags (all selected tags must be present)
    if (selectedTagIds.value.length > 0) {
      result = result.filter(p => {
        const projectTagIds = p.tags.map(t => t.id)
        return selectedTagIds.value.every(tagId => projectTagIds.includes(tagId))
      })
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField.value) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'createdAt':
          comparison = a.createdAt - b.createdAt
          break
        case 'updatedAt':
        default:
          comparison = a.updatedAt - b.updatedAt
          break
      }
      return sortOrder.value === 'asc' ? comparison : -comparison
    })

    return result
  })

  // Count projects by view
  const projectCounts = computed(() => {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
    return {
      all: projects.value.filter(p => !p.isTrashed && !p.isArchived).length,
      recent: projects.value.filter(p => p.updatedAt >= sevenDaysAgo && !p.isTrashed && !p.isArchived).length,
      starred: projects.value.filter(p => p.isStarred && !p.isTrashed && !p.isArchived).length,
      archived: projects.value.filter(p => p.isArchived && !p.isTrashed).length,
      trashed: projects.value.filter(p => p.isTrashed).length,
    }
  })

  // Actions
  async function fetchProjects(params?: {
    folder?: string | null
    starred?: boolean
    archived?: boolean
    trashed?: boolean
    tags?: string[]
    search?: string
    sort?: ProjectSortField
    order?: 'asc' | 'desc'
    recent?: boolean
  }): Promise<void> {
    if (!authStore.isPaidUser) return

    isLoading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      
      if (params?.folder !== undefined) {
        queryParams.set('folder', params.folder || 'null')
      }
      if (params?.starred) queryParams.set('starred', 'true')
      if (params?.archived) queryParams.set('archived', 'true')
      if (params?.trashed) queryParams.set('trashed', 'true')
      if (params?.tags?.length) queryParams.set('tags', params.tags.join(','))
      if (params?.search) queryParams.set('search', params.search)
      if (params?.sort) queryParams.set('sort', params.sort)
      if (params?.order) queryParams.set('order', params.order)
      if (params?.recent) queryParams.set('recent', 'true')

      const url = `${API_URL}/api/projects${queryParams.toString() ? `?${queryParams}` : ''}`
      const response = await fetch(url, {
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

      // Detect if project was saved in different theme than current
      const projectBgColor = project.appState?.viewBackgroundColor || '#ffffff'
      const projectIsDark = isColorDark(projectBgColor)
      const currentIsDark = appStore.isDarkMode
      const needsThemeInversion = projectIsDark !== currentIsDark

      // Load elements into canvas store
      canvasStore.setElements(project.elements)
      
      // If theme mismatch, invert the element colors to match current theme
      if (needsThemeInversion) {
        canvasStore.invertElementColors()
        // Set the correct background for current theme
        canvasStore.setThemeMode(currentIsDark)
      } else if (project.appState) {
        // Same theme, load the saved appState
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

  async function createProject(name?: string, folderId?: string | null): Promise<string | null> {
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
          folderId: folderId ?? currentFolderId.value,
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
        isDarkTheme: isColorDark(appState.viewBackgroundColor),
        folderId: project.folderId,
        isStarred: project.isStarred,
        isArchived: project.isArchived,
        isTrashed: project.isTrashed,
        trashedAt: project.trashedAt,
        tags: project.tags,
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
          isDarkTheme: isColorDark(appState.viewBackgroundColor),
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

      // Update in list - mark as trashed or remove if was already trashed
      const project = projects.value.find(p => p.id === projectId)
      if (project?.isTrashed) {
        projects.value = projects.value.filter(p => p.id !== projectId)
      } else {
        const index = projects.value.findIndex(p => p.id === projectId)
        if (index !== -1) {
          const now = Math.floor(Date.now() / 1000)
          projects.value[index] = {
            ...projects.value[index],
            isTrashed: true,
            trashedAt: now,
          }
        }
      }

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

  async function permanentlyDeleteProject(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/permanent`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to permanently delete project')
      }

      projects.value = projects.value.filter(p => p.id !== projectId)

      if (currentProjectId.value === projectId) {
        currentProjectId.value = null
        currentProjectName.value = 'Untitled'
        lastSavedAt.value = null
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to permanently delete project:', e)
      return false
    }
  }

  async function restoreProject(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/restore`, {
        method: 'POST',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to restore project')
      }

      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          isTrashed: false,
          trashedAt: null,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to restore project:', e)
      return false
    }
  }

  async function emptyTrash(): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/trash/empty`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to empty trash')
      }

      projects.value = projects.value.filter(p => !p.isTrashed)

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to empty trash:', e)
      return false
    }
  }

  async function toggleStarred(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/star`, {
        method: 'POST',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle starred')
      }

      const data = await response.json()
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          isStarred: data.isStarred,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to toggle starred:', e)
      return false
    }
  }

  async function toggleArchived(projectId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/archive`, {
        method: 'POST',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle archived')
      }

      const data = await response.json()
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          isArchived: data.isArchived,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to toggle archived:', e)
      return false
    }
  }

  async function moveToFolder(projectId: string, folderId: string | null): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ folderId }),
      })

      if (!response.ok) {
        throw new Error('Failed to move project')
      }

      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          folderId,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to move project:', e)
      return false
    }
  }

  async function addTagsToProject(projectId: string, tagIds: string[]): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ tagIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to add tags')
      }

      const data = await response.json()
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          tags: data.tags,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to add tags:', e)
      return false
    }
  }

  async function removeTagFromProject(projectId: string, tagId: string): Promise<boolean> {
    if (!authStore.isPaidUser) return false

    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/tags/${tagId}`, {
        method: 'DELETE',
        headers: authStore.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to remove tag')
      }

      const data = await response.json()
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = {
          ...projects.value[index],
          tags: data.tags,
        }
      }

      return true
    } catch (e) {
      error.value = (e as Error).message
      console.error('Failed to remove tag:', e)
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
        isDarkTheme: false,
        folderId: project.folderId,
        isStarred: project.isStarred,
        isArchived: project.isArchived,
        isTrashed: project.isTrashed,
        trashedAt: project.trashedAt,
        tags: project.tags,
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

  // Disconnect from current project without clearing canvas
  function disconnectFromProject() {
    // Cancel any pending save
    if (saveTimeout) clearTimeout(saveTimeout)
    currentProjectId.value = null
    currentProjectName.value = 'Untitled'
    lastSavedAt.value = null
  }

  // Create new empty project (clears canvas)
  function newProject() {
    disconnectFromProject()
    canvasStore.clearCanvas()
  }

  // View/Filter setters
  function setView(view: ProjectView, folderId?: string | null) {
    currentView.value = view
    if (view === 'folder') {
      currentFolderId.value = folderId ?? null
    }
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setSelectedTags(tagIds: string[]) {
    selectedTagIds.value = tagIds
  }

  function setSort(field: ProjectSortField, order: 'asc' | 'desc') {
    sortField.value = field
    sortOrder.value = order
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function clearFilters() {
    searchQuery.value = ''
    selectedTagIds.value = []
  }

  // Generate thumbnail from canvas
  async function generateThumbnail(): Promise<string | null> {
    const elements = canvasStore.visibleElements
    if (elements.length === 0) return null

    try {
      // Calculate bounds
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      elements.forEach(el => {
        if ((el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') && el.points) {
          el.points.forEach(p => {
            minX = Math.min(minX, el.x + p.x)
            minY = Math.min(minY, el.y + p.y)
            maxX = Math.max(maxX, el.x + p.x)
            maxY = Math.max(maxY, el.y + p.y)
          })
        } else {
          minX = Math.min(minX, el.x)
          minY = Math.min(minY, el.y)
          maxX = Math.max(maxX, el.x + el.width)
          maxY = Math.max(maxY, el.y + el.height)
        }
      })

      if (!isFinite(minX)) return null

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const padding = Math.max(Math.max(contentWidth, contentHeight) * 0.04, 10)

      // Thumbnail dimensions
      const thumbWidth = 320
      const thumbHeight = 200
      const scale = Math.min(
        (thumbWidth - padding * 2) / contentWidth,
        (thumbHeight - padding * 2) / contentHeight,
        2
      )

      const canvas = document.createElement('canvas')
      canvas.width = thumbWidth
      canvas.height = thumbHeight
      const ctx = canvas.getContext('2d')!

      // Fill background
      ctx.fillStyle = canvasStore.appState.viewBackgroundColor
      ctx.fillRect(0, 0, thumbWidth, thumbHeight)

      // Center content in thumbnail
      const scaledWidth = contentWidth * scale
      const scaledHeight = contentHeight * scale
      const offsetX = (thumbWidth - scaledWidth) / 2
      const offsetY = (thumbHeight - scaledHeight) / 2

      ctx.translate(offsetX, offsetY)
      ctx.scale(scale, scale)
      ctx.translate(-minX, -minY)

      // Render elements
      renderElementsToThumbnail(canvas, ctx, elements)

      return canvas.toDataURL('image/webp', 0.8)
    } catch (e) {
      console.error('Failed to generate thumbnail:', e)
      return null
    }
  }

  // Helper to get roughjs options
  function getRoughOptions(el: ExcalidrawElement) {
    const dashGap = el.strokeStyle === 'dashed' ? [12, 8] : el.strokeStyle === 'dotted' ? [3, 6] : undefined
    return {
      seed: el.seed,
      roughness: el.roughness,
      bowing: el.roughness,
      strokeWidth: el.strokeWidth,
      stroke: el.strokeColor,
      fill: el.backgroundColor !== 'transparent' ? el.backgroundColor : undefined,
      fillStyle: el.fillStyle === 'none' ? undefined : el.fillStyle,
      strokeLineDash: dashGap,
    }
  }

  // Render elements to thumbnail canvas
  function renderElementsToThumbnail(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, elements: ExcalidrawElement[]) {
    const rc = rough.canvas(canvas)

    elements.forEach(el => {
      if (el.isDeleted) return

      ctx.save()
      ctx.globalAlpha = el.opacity / 100

      if (el.angle) {
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        ctx.translate(cx, cy)
        ctx.rotate(el.angle)
        ctx.translate(-cx, -cy)
      }

      const options = getRoughOptions(el)

      switch (el.type) {
        case 'rectangle':
          if (el.roundness && el.roundness.type === 3) {
            const radius = Math.min(Math.abs(el.width), Math.abs(el.height)) * 0.1
            const r = Math.min(radius, Math.abs(el.width) / 2, Math.abs(el.height) / 2)
            const actualX = el.width < 0 ? el.x + el.width : el.x
            const actualY = el.height < 0 ? el.y + el.height : el.y
            const actualW = Math.abs(el.width)
            const actualH = Math.abs(el.height)
            const path = `M ${actualX + r} ${actualY} L ${actualX + actualW - r} ${actualY} Q ${actualX + actualW} ${actualY} ${actualX + actualW} ${actualY + r} L ${actualX + actualW} ${actualY + actualH - r} Q ${actualX + actualW} ${actualY + actualH} ${actualX + actualW - r} ${actualY + actualH} L ${actualX + r} ${actualY + actualH} Q ${actualX} ${actualY + actualH} ${actualX} ${actualY + actualH - r} L ${actualX} ${actualY + r} Q ${actualX} ${actualY} ${actualX + r} ${actualY} Z`
            rc.path(path, options)
          } else {
            rc.rectangle(el.x, el.y, el.width, el.height, options)
          }
          break
        case 'ellipse':
          rc.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, options)
          break
        case 'diamond':
          const dcx = el.x + el.width / 2
          const dcy = el.y + el.height / 2
          rc.polygon([
            [dcx, el.y],
            [el.x + el.width, dcy],
            [dcx, el.y + el.height],
            [el.x, dcy],
          ], options)
          break
        case 'line':
        case 'arrow':
          if (el.points && el.points.length >= 2) {
            const pts: [number, number][] = el.points.map(p => [el.x + p.x, el.y + p.y])
            if (pts.length === 2) {
              rc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], options)
            } else {
              rc.linearPath(pts, options)
            }
            if (el.type === 'arrow' && el.endArrowhead && el.endArrowhead !== 'none') {
              const last = pts[pts.length - 1]
              const prev = pts[pts.length - 2]
              const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0])
              const size = 15 + el.strokeWidth * 2
              rc.linearPath([
                [last[0] - size * Math.cos(angle - Math.PI / 6), last[1] - size * Math.sin(angle - Math.PI / 6)],
                last,
                [last[0] - size * Math.cos(angle + Math.PI / 6), last[1] - size * Math.sin(angle + Math.PI / 6)],
              ], options)
            }
          }
          break
        case 'freedraw':
          if (el.points && el.points.length >= 2) {
            ctx.strokeStyle = el.strokeColor
            ctx.lineWidth = el.strokeWidth
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.beginPath()
            ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y)
            el.points.slice(1).forEach(p => ctx.lineTo(el.x + p.x, el.y + p.y))
            ctx.stroke()
          }
          break
        case 'text':
          if (el.text) {
            let fontFamily = 'system-ui'
            if (el.fontFamily === 'virgil') fontFamily = '"Caveat", cursive'
            else if (el.fontFamily === 'code') fontFamily = '"Fira Code", monospace'
            ctx.font = `${el.fontSize}px ${fontFamily}`
            ctx.fillStyle = el.strokeColor
            ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'center'
            ctx.textBaseline = 'middle'
            const lines = el.text.split('\n')
            const lineHeight = (el.fontSize || 20) * (el.lineHeight || 1.25)
            const totalTextHeight = lines.length * lineHeight
            let tx = el.x + el.width / 2
            if (el.textAlign === 'left') { tx = el.x; ctx.textAlign = 'left' }
            else if (el.textAlign === 'right') { tx = el.x + el.width; ctx.textAlign = 'right' }
            const startY = el.y + (el.height - totalTextHeight) / 2 + lineHeight / 2
            lines.forEach((line, i) => ctx.fillText(line, tx, startY + i * lineHeight))
          }
          break
      }

      ctx.restore()
    })
  }

  // Watch for element changes and auto-save if we have a current project
  watch(
    () => canvasStore.elements,
    () => {
      // Don't save if receiving remote updates (collaboration) or no project open
      if (canvasStore.isReceivingRemoteUpdate) return
      if (currentProjectId.value && authStore.isPaidUser) {
        debouncedSave()
      }
    },
    { deep: true }
  )

  // Also watch for appState changes (background color, etc.)
  watch(
    () => canvasStore.appState.viewBackgroundColor,
    () => {
      if (currentProjectId.value && authStore.isPaidUser) {
        debouncedSave()
      }
    }
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

    // View/Filter State
    currentView,
    currentFolderId,
    searchQuery,
    selectedTagIds,
    sortField,
    sortOrder,
    viewMode,

    // Computed
    currentProject,
    isCloudProject,
    filteredProjects,
    projectCounts,

    // Actions
    fetchProjects,
    loadProject,
    createProject,
    saveProject,
    deleteProject,
    permanentlyDeleteProject,
    restoreProject,
    emptyTrash,
    toggleStarred,
    toggleArchived,
    moveToFolder,
    addTagsToProject,
    removeTagFromProject,
    duplicateProject,
    renameProject,
    newProject,
    disconnectFromProject,
    debouncedSave,

    // View/Filter Actions
    setView,
    setSearchQuery,
    setSelectedTags,
    setSort,
    setViewMode,
    clearFilters,
  }
})
