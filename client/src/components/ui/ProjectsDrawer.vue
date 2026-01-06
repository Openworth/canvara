<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useProjectsStore, type ProjectListItem } from '../../stores/projects'
import { useFoldersStore } from '../../stores/folders'
import { useTagsStore } from '../../stores/tags'
import { useAuthStore } from '../../stores/auth'
import { useAppStore } from '../../stores/app'
import type { Folder, ProjectView } from '../../types'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import CreateFolderModal from '../modals/CreateFolderModal.vue'
import ManageTagsModal from '../modals/ManageTagsModal.vue'
import FolderItem from './FolderItem.vue'
import TagChip from './TagChip.vue'
import TagPicker from './TagPicker.vue'
import ProjectContextMenu from './ProjectContextMenu.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const projectsStore = useProjectsStore()
const foldersStore = useFoldersStore()
const tagsStore = useTagsStore()
const authStore = useAuthStore()
const appStore = useAppStore()

// Animation state
const isVisible = ref(false)

// Check if a thumbnail needs to be inverted to match current theme
function shouldInvertThumbnail(project: ProjectListItem): boolean {
  // If no thumbnail or no theme info, don't invert
  if (!project.thumbnail) return false
  
  // Invert if project theme doesn't match current app theme
  return project.isDarkTheme !== appStore.isDarkMode
}

// UI State
const showDeleteConfirm = ref(false)
const projectToDelete = ref<ProjectListItem | null>(null)
const isPermanentDelete = ref(false)
const editingProjectId = ref<string | null>(null)
const editingName = ref('')
const editingCurrentName = ref(false)
const currentNameInput = ref('')
const hoveredProjectId = ref<string | null>(null)
const showCreateFolderModal = ref(false)
const showManageTagsModal = ref(false)
const editingFolderId = ref<string | null>(null)
const showTagPicker = ref<string | null>(null)
const contextMenuProject = ref<ProjectListItem | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })
const draggingProjectId = ref<string | null>(null)

// Handle escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && !showDeleteConfirm.value && !showCreateFolderModal.value && !showManageTagsModal.value && !showTagPicker.value) {
    emit('close')
  }
}

onMounted(async () => {
  // Trigger entrance animation
  requestAnimationFrame(() => {
    isVisible.value = true
  })
  
  // Add keyboard listener
  document.addEventListener('keydown', handleKeydown)
  
  await Promise.all([
    // Fetch all projects including trashed and archived so filtering works properly
    projectsStore.fetchProjects({ includeAll: true }),
    foldersStore.fetchFolders(),
    tagsStore.fetchTags(),
  ])
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Computed
const currentViewTitle = computed(() => {
  switch (projectsStore.currentView) {
    case 'all': return 'All Projects'
    case 'recent': return 'Recent'
    case 'starred': return 'Starred'
    case 'archived': return 'Archive'
    case 'trashed': return 'Trash'
    case 'folder':
      const folder = foldersStore.folders.find(f => f.id === projectsStore.currentFolderId)
      return folder?.name || 'Folder'
    default: return 'Projects'
  }
})

const currentFolderColor = computed(() => {
  if (projectsStore.currentView === 'folder' && projectsStore.currentFolderId) {
    const folder = foldersStore.folders.find(f => f.id === projectsStore.currentFolderId)
    return folder?.color
  }
  return null
})

// Compute folder counts reactively from projects list
const folderCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const project of projectsStore.projects) {
    if (!project.isTrashed && !project.isArchived && project.folderId) {
      counts[project.folderId] = (counts[project.folderId] || 0) + 1
    }
  }
  return counts
})

// Format date helper
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) return 'Just now'
  else if (diffMinutes < 60) return `${diffMinutes}m ago`
  else if (diffHours < 24) return `${diffHours}h ago`
  else if (diffDays === 1) return 'Yesterday'
  else if (diffDays < 7) return `${diffDays} days ago`
  else return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Navigation handlers
function setView(view: ProjectView, folderId?: string | null) {
  projectsStore.setView(view, folderId)
}

// Project handlers
async function handleLoadProject(project: ProjectListItem) {
  await projectsStore.loadProject(project.id)
  emit('close')
}

function handleNewProject() {
  projectsStore.newProject()
  emit('close')
}

async function handleCreateProject() {
  await projectsStore.createProject()
  // Don't close the menu - let user continue browsing projects
}

function handleDeleteClick(project: ProjectListItem, permanent = false) {
  projectToDelete.value = project
  isPermanentDelete.value = permanent || project.isTrashed
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (projectToDelete.value) {
    if (isPermanentDelete.value) {
      await projectsStore.permanentlyDeleteProject(projectToDelete.value.id)
    } else {
      await projectsStore.deleteProject(projectToDelete.value.id)
    }
  }
  showDeleteConfirm.value = false
  projectToDelete.value = null
  isPermanentDelete.value = false
}

async function handleDuplicate(project: ProjectListItem) {
  await projectsStore.duplicateProject(project.id)
}

function startRenaming(project: ProjectListItem) {
  editingProjectId.value = project.id
  editingName.value = project.name
}

async function saveRename(project: ProjectListItem) {
  if (editingName.value.trim() && editingName.value !== project.name) {
    const index = projectsStore.projects.findIndex(p => p.id === project.id)
    if (index !== -1) {
      projectsStore.projects[index].name = editingName.value.trim()
    }
    
    if (project.id === projectsStore.currentProjectId) {
      projectsStore.renameProject(editingName.value.trim())
    } else {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      await fetch(`${API_URL}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authStore.getAuthHeaders() },
        body: JSON.stringify({ name: editingName.value.trim() }),
      })
    }
  }
  editingProjectId.value = null
  editingName.value = ''
}

function cancelRename() {
  editingProjectId.value = null
  editingName.value = ''
}

function startEditingCurrentName() {
  editingCurrentName.value = true
  currentNameInput.value = projectsStore.currentProjectName
}

function saveCurrentName() {
  if (currentNameInput.value.trim() && currentNameInput.value !== projectsStore.currentProjectName) {
    projectsStore.renameProject(currentNameInput.value.trim())
    
    const index = projectsStore.projects.findIndex(p => p.id === projectsStore.currentProjectId)
    if (index !== -1) {
      projectsStore.projects[index].name = currentNameInput.value.trim()
    }
  }
  editingCurrentName.value = false
  currentNameInput.value = ''
}

function cancelEditingCurrentName() {
  editingCurrentName.value = false
  currentNameInput.value = ''
}

// Folder handlers
function handleFolderSelect(folder: Folder) {
  setView('folder', folder.id)
}

function handleFolderEdit(folder: Folder) {
  editingFolderId.value = editingFolderId.value === folder.id ? null : folder.id
}

async function handleFolderRename(folder: Folder, name: string) {
  await foldersStore.updateFolder(folder.id, { name })
  editingFolderId.value = null
}

async function handleFolderDelete(folder: Folder) {
  await foldersStore.deleteFolder(folder.id)
  if (projectsStore.currentView === 'folder' && projectsStore.currentFolderId === folder.id) {
    setView('all')
  }
}

async function handleFolderDrop(folder: Folder, projectId: string) {
  await projectsStore.moveToFolder(projectId, folder.id)
}

function handleFolderCreated(folderId: string) {
  setView('folder', folderId)
}

// Tag handlers
async function handleTagsUpdate(projectId: string, tagIds: string[]) {
  const project = projectsStore.projects.find(p => p.id === projectId)
  if (!project) return

  const currentTagIds = project.tags.map(t => t.id)
  const toAdd = tagIds.filter(id => !currentTagIds.includes(id))
  const toRemove = currentTagIds.filter(id => !tagIds.includes(id))

  if (toAdd.length > 0) {
    await projectsStore.addTagsToProject(projectId, toAdd)
  }
  for (const tagId of toRemove) {
    await projectsStore.removeTagFromProject(projectId, tagId)
  }

  showTagPicker.value = null
}

// Star/Archive handlers
async function handleToggleStar(project: ProjectListItem) {
  await projectsStore.toggleStarred(project.id)
}

async function handleToggleArchive(project: ProjectListItem) {
  await projectsStore.toggleArchived(project.id)
}

async function handleRestore(project: ProjectListItem) {
  await projectsStore.restoreProject(project.id)
}

async function handleEmptyTrash() {
  await projectsStore.emptyTrash()
}

// Context menu
function showContextMenu(e: MouseEvent, project: ProjectListItem) {
  e.preventDefault()
  contextMenuProject.value = project
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenuProject.value = null
}

async function handleContextMenuMove(folderId: string | null) {
  if (contextMenuProject.value) {
    await projectsStore.moveToFolder(contextMenuProject.value.id, folderId)
  }
}

function handleContextMenuManageTags() {
  if (contextMenuProject.value) {
    showTagPicker.value = contextMenuProject.value.id
  }
}

// Drag and drop
function handleDragStart(e: DragEvent, project: ProjectListItem) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('projectId', project.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  draggingProjectId.value = project.id
}

function handleDragEnd() {
  draggingProjectId.value = null
}

async function handleDropOnRoot(e: DragEvent) {
  e.preventDefault()
  const projectId = e.dataTransfer?.getData('projectId')
  if (projectId) {
    await projectsStore.moveToFolder(projectId, null)
  }
}

// Search
function handleSearch(e: Event) {
  const target = e.target as HTMLInputElement
  projectsStore.setSearchQuery(target.value)
}

// Sort
function toggleSort() {
  const newOrder = projectsStore.sortOrder === 'desc' ? 'asc' : 'desc'
  projectsStore.setSort(projectsStore.sortField, newOrder)
}

function setSortField(field: 'name' | 'createdAt' | 'updatedAt') {
  projectsStore.setSort(field, projectsStore.sortOrder)
}
</script>

<template>
  <div class="drawer-overlay" :class="{ visible: isVisible }" @click.self="emit('close')">
    <div class="drawer" :class="{ visible: isVisible }">
      <!-- Sidebar -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h3>Projects</h3>
          <button class="icon-btn" v-tooltip.right="'New folder'" @click="showCreateFolderModal = true">
            <ToolIcon name="folderPlus" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <!-- Main views -->
          <button
            class="nav-item"
            :class="{ active: projectsStore.currentView === 'all' }"
            @click="setView('all')"
          >
            <ToolIcon name="layers" />
            <span>All Projects</span>
            <span class="count">{{ projectsStore.projectCounts.all }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: projectsStore.currentView === 'recent' }"
            @click="setView('recent')"
          >
            <ToolIcon name="clock" />
            <span>Recent</span>
            <span class="count">{{ projectsStore.projectCounts.recent }}</span>
          </button>

          <button
            class="nav-item"
            :class="{ active: projectsStore.currentView === 'starred' }"
            @click="setView('starred')"
          >
            <ToolIcon name="star" />
            <span>Starred</span>
            <span class="count">{{ projectsStore.projectCounts.starred }}</span>
          </button>

          <!-- Folders section -->
          <div class="nav-section">
            <div class="nav-section-header">
              <span>Folders</span>
            </div>

            <button
              class="nav-item folder-root"
              :class="{ active: projectsStore.currentView === 'folder' && !projectsStore.currentFolderId }"
              @click="setView('folder', null)"
              @dragover.prevent
              @drop="handleDropOnRoot"
            >
              <ToolIcon name="home" />
              <span>Unfiled</span>
            </button>

            <FolderItem
              v-for="folder in foldersStore.sortedFolders"
              :key="folder.id"
              :folder="folder"
              :is-active="projectsStore.currentView === 'folder' && projectsStore.currentFolderId === folder.id"
              :is-editing="editingFolderId === folder.id"
              :count="folderCounts[folder.id] || 0"
              @select="handleFolderSelect(folder)"
              @edit="handleFolderEdit(folder)"
              @delete="handleFolderDelete(folder)"
              @rename="(name) => handleFolderRename(folder, name)"
              @drop="(projectId) => handleFolderDrop(folder, projectId)"
            />

            <button class="nav-item add-folder" @click="showCreateFolderModal = true">
              <ToolIcon name="plus" />
              <span>New Folder</span>
            </button>
          </div>

          <!-- Bottom section -->
          <div class="nav-section bottom">
            <button
              class="nav-item"
              :class="{ active: projectsStore.currentView === 'archived' }"
              @click="setView('archived')"
            >
              <ToolIcon name="archive" />
              <span>Archive</span>
              <span class="count">{{ projectsStore.projectCounts.archived }}</span>
            </button>

            <button
              class="nav-item"
              :class="{ active: projectsStore.currentView === 'trashed' }"
              @click="setView('trashed')"
            >
              <ToolIcon name="trash" />
              <span>Trash</span>
              <span class="count">{{ projectsStore.projectCounts.trashed }}</span>
            </button>

            <button class="nav-item" @click="showManageTagsModal = true">
              <ToolIcon name="tag" />
              <span>Manage Tags</span>
            </button>
          </div>
        </nav>
      </div>

      <!-- Main content -->
      <div class="main-content">
        <!-- Header -->
        <div class="content-header">
          <button class="back-btn mobile-only" @click="emit('close')" aria-label="Go back">
            <ToolIcon name="chevronLeft" />
          </button>

          <div class="header-title">
            <span v-if="currentFolderColor" class="folder-indicator" :style="{ background: currentFolderColor }" />
            <h2>{{ currentViewTitle }}</h2>
          </div>

          <button class="close-btn" @click="emit('close')" aria-label="Close">
            <ToolIcon name="close" />
          </button>
        </div>

        <!-- Toolbar -->
        <div class="content-toolbar">
          <div class="search-box">
            <ToolIcon name="search" class="search-icon" />
            <input
              type="text"
              placeholder="Search projects..."
              :value="projectsStore.searchQuery"
              @input="handleSearch"
            />
            <button
              v-if="projectsStore.searchQuery"
              class="clear-search"
              @click="projectsStore.setSearchQuery('')"
            >
              <ToolIcon name="close" />
            </button>
          </div>

          <div class="toolbar-actions">
            <!-- Sort dropdown -->
            <div class="sort-dropdown">
              <button class="toolbar-btn" @click="toggleSort">
                <ToolIcon :name="projectsStore.sortOrder === 'desc' ? 'sortDesc' : 'sortAsc'" />
              </button>
              <select
                :value="projectsStore.sortField"
                @change="setSortField(($event.target as HTMLSelectElement).value as any)"
                class="sort-select"
              >
                <option value="updatedAt">Modified</option>
                <option value="createdAt">Created</option>
                <option value="name">Name</option>
              </select>
            </div>

            <!-- View toggle -->
            <div class="view-toggle">
              <button
                class="toggle-btn"
                :class="{ active: projectsStore.viewMode === 'grid' }"
                @click="projectsStore.setViewMode('grid')"
              >
                <ToolIcon name="grid" />
              </button>
              <button
                class="toggle-btn"
                :class="{ active: projectsStore.viewMode === 'list' }"
                @click="projectsStore.setViewMode('list')"
              >
                <ToolIcon name="list" />
              </button>
            </div>
          </div>
        </div>

        <!-- Quick actions for non-trash views -->
        <div v-if="projectsStore.currentView !== 'trashed'" class="quick-actions">
          <button class="quick-action-btn primary" @click="handleCreateProject">
            <div class="action-icon">
              <ToolIcon name="plus" />
            </div>
            <div class="action-content">
              <span class="action-label">Save current</span>
              <span class="action-hint">Save canvas to cloud</span>
            </div>
          </button>
          <button class="quick-action-btn" @click="handleNewProject">
            <div class="action-icon">
              <ToolIcon name="file" />
            </div>
            <div class="action-content">
              <span class="action-label">New blank</span>
              <span class="action-hint">Start fresh</span>
            </div>
          </button>
        </div>

        <!-- Empty trash button -->
        <div v-if="projectsStore.currentView === 'trashed' && projectsStore.projectCounts.trashed > 0" class="trash-actions">
          <button class="empty-trash-btn" @click="handleEmptyTrash">
            <ToolIcon name="trash" />
            <span>Empty Trash</span>
          </button>
          <p class="trash-hint">Items in trash will be permanently deleted after 30 days.</p>
        </div>

        <!-- Projects container -->
        <div class="projects-container">
          <div v-if="projectsStore.isLoading" class="loading-state">
            <div class="spinner" />
            <span>Loading your projects...</span>
          </div>

          <div v-else-if="projectsStore.filteredProjects.length === 0" class="empty-state">
            <div class="empty-illustration">
              <div class="empty-icon">
                <ToolIcon :name="projectsStore.currentView === 'trashed' ? 'trash' : 'folderOpen'" />
              </div>
            </div>
            <h3 class="empty-title">
              {{ projectsStore.searchQuery ? 'No matching projects' : 'No projects here' }}
            </h3>
            <p class="empty-description">
              {{ projectsStore.searchQuery 
                ? 'Try a different search term' 
                : projectsStore.currentView === 'trashed'
                  ? 'Deleted projects will appear here'
                  : 'Save your current canvas or create a new project!' 
              }}
            </p>
          </div>

          <!-- Grid view -->
          <div v-else-if="projectsStore.viewMode === 'grid'" class="projects-grid">
            <div
              v-for="(project, index) in projectsStore.filteredProjects"
              :key="project.id"
              :class="['project-card', { 
                active: project.id === projectsStore.currentProjectId,
                dragging: project.id === draggingProjectId
              }]"
              :style="{ '--delay': `${index * 0.02}s` }"
              draggable="true"
              @click="handleLoadProject(project)"
              @contextmenu="showContextMenu($event, project)"
              @mouseenter="hoveredProjectId = project.id"
              @mouseleave="hoveredProjectId = null"
              @dragstart="handleDragStart($event, project)"
              @dragend="handleDragEnd"
            >
              <!-- Thumbnail -->
              <div class="project-thumbnail" :class="{ dark: project.isDarkTheme, 'invert-for-theme': shouldInvertThumbnail(project) }">
                <img 
                  v-if="project.thumbnail" 
                  :src="project.thumbnail" 
                  :alt="project.name"
                  loading="lazy"
                />
                <div v-else class="thumbnail-placeholder">
                  <div class="placeholder-pattern">
                    <div class="pattern-shape rect"></div>
                    <div class="pattern-shape circle"></div>
                    <div class="pattern-shape line"></div>
                  </div>
                </div>
                
                <!-- Star button -->
                <button
                  v-if="!project.isTrashed"
                  class="star-btn"
                  :class="{ starred: project.isStarred }"
                  @click.stop="handleToggleStar(project)"
                >
                  <ToolIcon :name="project.isStarred ? 'starFilled' : 'star'" />
                </button>

                <!-- Active indicator -->
                <div v-if="project.id === projectsStore.currentProjectId" class="active-badge">
                  <ToolIcon name="check" />
                  <span>Current</span>
                </div>
              </div>

              <!-- Info -->
              <div class="project-info" @click.stop>
                <template v-if="editingProjectId === project.id">
                  <input
                    v-model="editingName"
                    class="project-name-input"
                    type="text"
                    @keydown.enter="saveRename(project)"
                    @keydown.escape="cancelRename"
                    @blur="saveRename(project)"
                    autofocus
                  />
                </template>
                <template v-else>
                  <span class="project-name" @click="handleLoadProject(project)">{{ project.name }}</span>
                </template>
                
                <!-- Tags -->
                <div v-if="project.tags.length > 0" class="project-tags">
                  <TagChip
                    v-for="tag in project.tags.slice(0, 2)"
                    :key="tag.id"
                    :tag="tag"
                    small
                  />
                  <span v-if="project.tags.length > 2" class="more-tags">
                    +{{ project.tags.length - 2 }}
                  </span>
                </div>

                <span class="project-date">
                  <ToolIcon name="clock" class="date-icon" />
                  {{ formatDate(project.updatedAt) }}
                </span>
              </div>

              <!-- Actions Overlay -->
              <div 
                class="project-actions" 
                :class="{ visible: hoveredProjectId === project.id }"
                @click.stop
              >
                <template v-if="project.isTrashed">
                  <button 
                    class="project-action-btn" 
                    v-tooltip.bottom="'Restore'"
                    @click="handleRestore(project)"
                  >
                    <ToolIcon name="undo" />
                  </button>
                  <button 
                    class="project-action-btn delete" 
                    v-tooltip.bottom="'Delete permanently'"
                    @click="handleDeleteClick(project, true)"
                  >
                    <ToolIcon name="trash" />
                  </button>
                </template>
                <template v-else>
                  <button 
                    class="project-action-btn" 
                    v-tooltip.bottom="'Rename'"
                    @click="startRenaming(project)"
                  >
                    <ToolIcon name="pencil" />
                  </button>
                  <button 
                    class="project-action-btn" 
                    v-tooltip.bottom="'Duplicate'"
                    @click="handleDuplicate(project)"
                  >
                    <ToolIcon name="copy" />
                  </button>
                  <button 
                    class="project-action-btn" 
                    v-tooltip.bottom="'Tags'"
                    @click="showTagPicker = project.id"
                  >
                    <ToolIcon name="tag" />
                  </button>
                  <button 
                    class="project-action-btn" 
                    :class="{ active: project.isArchived }"
                    v-tooltip.bottom="project.isArchived ? 'Unarchive' : 'Archive'"
                    @click="handleToggleArchive(project)"
                  >
                    <ToolIcon name="archive" />
                  </button>
                  <button 
                    class="project-action-btn delete" 
                    v-tooltip.bottom="'Delete'"
                    @click="handleDeleteClick(project)"
                  >
                    <ToolIcon name="trash" />
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- List view -->
          <div v-else class="projects-list">
            <div
              v-for="project in projectsStore.filteredProjects"
              :key="project.id"
              :class="['project-list-item', { 
                active: project.id === projectsStore.currentProjectId,
                dragging: project.id === draggingProjectId
              }]"
              draggable="true"
              @click="handleLoadProject(project)"
              @contextmenu="showContextMenu($event, project)"
              @dragstart="handleDragStart($event, project)"
              @dragend="handleDragEnd"
            >
              <!-- Mini thumbnail -->
              <div class="list-thumbnail" :class="{ dark: project.isDarkTheme, 'invert-for-theme': shouldInvertThumbnail(project) }">
                <img v-if="project.thumbnail" :src="project.thumbnail" :alt="project.name" />
                <ToolIcon v-else name="file" />
              </div>

              <!-- Info -->
              <div class="list-info">
                <template v-if="editingProjectId === project.id">
                  <input
                    v-model="editingName"
                    class="project-name-input"
                    type="text"
                    @click.stop
                    @keydown.enter="saveRename(project)"
                    @keydown.escape="cancelRename"
                    @blur="saveRename(project)"
                    autofocus
                  />
                </template>
                <template v-else>
                  <span class="list-name">{{ project.name }}</span>
                </template>
                <span class="list-date">{{ formatDate(project.updatedAt) }}</span>
              </div>

              <!-- Tags -->
              <div v-if="project.tags.length > 0" class="list-tags">
                <TagChip
                  v-for="tag in project.tags.slice(0, 3)"
                  :key="tag.id"
                  :tag="tag"
                  small
                />
                <span v-if="project.tags.length > 3" class="more-tags">+{{ project.tags.length - 3 }}</span>
              </div>

              <!-- Actions (shown on hover, before star for consistent layout) -->
              <div class="list-actions" @click.stop>
                <template v-if="project.isTrashed">
                  <button class="action-btn" @click="handleRestore(project)">
                    <ToolIcon name="undo" />
                  </button>
                  <button class="action-btn delete" @click="handleDeleteClick(project, true)">
                    <ToolIcon name="trash" />
                  </button>
                </template>
                <template v-else>
                  <button class="action-btn" v-tooltip.bottom="'Rename'" @click="startRenaming(project)">
                    <ToolIcon name="pencil" />
                  </button>
                  <button class="action-btn" v-tooltip.bottom="'Duplicate'" @click="handleDuplicate(project)">
                    <ToolIcon name="copy" />
                  </button>
                  <button class="action-btn" v-tooltip.bottom="'Tags'" @click="showTagPicker = project.id">
                    <ToolIcon name="tag" />
                  </button>
                  <button 
                    class="action-btn" 
                    :class="{ active: project.isArchived }"
                    v-tooltip.bottom="project.isArchived ? 'Unarchive' : 'Archive'" 
                    @click="handleToggleArchive(project)"
                  >
                    <ToolIcon name="archive" />
                  </button>
                  <button class="action-btn delete" v-tooltip.bottom="'Delete'" @click="handleDeleteClick(project)">
                    <ToolIcon name="trash" />
                  </button>
                </template>
              </div>

              <!-- Star (always visible, rightmost position) -->
              <button
                v-if="!project.isTrashed"
                class="list-star"
                :class="{ starred: project.isStarred }"
                @click.stop="handleToggleStar(project)"
              >
                <ToolIcon :name="project.isStarred ? 'starFilled' : 'star'" />
              </button>
            </div>
          </div>
        </div>

        <!-- Current Project Footer -->
        <div v-if="projectsStore.isCloudProject" class="current-project-footer">
          <div class="footer-inner">
            <div class="current-info">
              <div class="current-icon">
                <ToolIcon name="cloud" />
              </div>
              <div class="current-details">
                <template v-if="editingCurrentName">
                  <input
                    v-model="currentNameInput"
                    class="current-name-input"
                    type="text"
                    @keydown.enter="saveCurrentName"
                    @keydown.escape="cancelEditingCurrentName"
                    @blur="saveCurrentName"
                    autofocus
                  />
                </template>
                <template v-else>
                  <span class="current-name" @click="startEditingCurrentName">
                    {{ projectsStore.currentProjectName }}
                    <ToolIcon name="pencil" class="edit-hint" />
                  </span>
                </template>
                <span v-if="projectsStore.isSaving" class="sync-status saving">
                  <span class="sync-dot"></span>
                  Saving...
                </span>
                <span v-else-if="projectsStore.lastSavedAt" class="sync-status saved">
                  <ToolIcon name="check" class="sync-icon" />
                  Saved {{ formatDate(projectsStore.lastSavedAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Context Menu -->
  <ProjectContextMenu
    v-if="contextMenuProject"
    :project="contextMenuProject"
    :x="contextMenuPosition.x"
    :y="contextMenuPosition.y"
    @close="closeContextMenu"
    @open="handleLoadProject(contextMenuProject!); closeContextMenu()"
    @rename="startRenaming(contextMenuProject!); closeContextMenu()"
    @duplicate="handleDuplicate(contextMenuProject!); closeContextMenu()"
    @star="handleToggleStar(contextMenuProject!); closeContextMenu()"
    @archive="handleToggleArchive(contextMenuProject!); closeContextMenu()"
    @trash="handleDeleteClick(contextMenuProject!); closeContextMenu()"
    @restore="handleRestore(contextMenuProject!); closeContextMenu()"
    @delete-permanent="handleDeleteClick(contextMenuProject!, true); closeContextMenu()"
    @move="handleContextMenuMove"
    @manage-tags="handleContextMenuManageTags"
  />

  <!-- Tag Picker Popover -->
  <Teleport to="body">
    <div
      v-if="showTagPicker"
      class="tag-picker-overlay"
      @click="showTagPicker = null"
    >
      <div
        class="tag-picker-container"
        @click.stop
      >
        <TagPicker
          :selected-tag-ids="projectsStore.projects.find(p => p.id === showTagPicker)?.tags.map(t => t.id) || []"
          :project-id="showTagPicker"
          @select="(tagIds) => handleTagsUpdate(showTagPicker!, tagIds)"
          @close="showTagPicker = null"
        />
      </div>
    </div>
  </Teleport>

  <!-- Delete confirmation modal -->
  <ConfirmModal
    v-if="showDeleteConfirm"
    :title="isPermanentDelete ? 'Delete permanently' : 'Move to trash'"
    :message="isPermanentDelete 
      ? `Are you sure you want to permanently delete '${projectToDelete?.name}'? This action cannot be undone.`
      : `Are you sure you want to move '${projectToDelete?.name}' to trash?`"
    :confirm-text="isPermanentDelete ? 'Delete' : 'Move to trash'"
    cancel-text="Cancel"
    :danger="true"
    @confirm="handleDeleteConfirm"
    @cancel="showDeleteConfirm = false"
  />

  <!-- Create Folder Modal -->
  <CreateFolderModal
    v-if="showCreateFolderModal"
    @close="showCreateFolderModal = false"
    @created="handleFolderCreated"
  />

  <!-- Manage Tags Modal -->
  <ManageTagsModal
    v-if="showManageTagsModal"
    @close="showManageTagsModal = false"
  />
</template>

<style scoped>
/* ============================================
   OVERLAY
   ============================================ */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  display: flex;
  justify-content: flex-start;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-overlay.visible {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
}

.dark .drawer-overlay.visible {
  background: rgba(0, 0, 0, 0.7);
}

/* ============================================
   DRAWER
   ============================================ */
.drawer {
  display: flex;
  width: 740px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-toolbar-bg-solid);
  box-shadow: 12px 0 48px -12px rgba(0, 0, 0, 0.25);
  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.drawer.visible {
  transform: translateX(0);
}

.dark .drawer {
  box-shadow: 12px 0 48px -12px rgba(0, 0, 0, 0.6);
}

/* ============================================
   SIDEBAR
   ============================================ */
.sidebar {
  width: 220px;
  border-right: 1px solid var(--color-toolbar-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: linear-gradient(180deg, 
    rgba(99, 102, 241, 0.02) 0%, 
    transparent 100%
  );
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.3px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-accent-primary);
  transform: scale(1.05);
}

.icon-btn:active {
  transform: scale(0.95);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: var(--color-text-tertiary) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--color-text-tertiary);
  border-radius: 2px;
}

/* ============================================
   NAV ITEMS
   ============================================ */
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  position: relative;
}

.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 0 2px 2px 0;
  transition: height 0.2s ease;
}

.nav-item:hover {
  background: var(--color-toolbar-hover);
}

.nav-item:hover::before {
  height: 50%;
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item.active {
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.18) 0%, 
    rgba(99, 102, 241, 0.10) 100%
  );
  color: #818cf8;
  font-weight: 600;
}

.dark .nav-item.active {
  color: #a5b4fc;
}

.nav-item.active::before {
  height: 65%;
  width: 4px;
}

.nav-item :deep(svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.nav-item:hover :deep(svg) {
  color: var(--color-accent-primary);
}

.nav-item.active :deep(svg) {
  color: #818cf8;
}

.dark .nav-item.active :deep(svg) {
  color: #a5b4fc;
}

.nav-item .count {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-toolbar-hover);
  padding: 3px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
  transition: all 0.2s ease;
}

.nav-item.active .count {
  background: rgba(99, 102, 241, 0.25);
  color: #818cf8;
}

.dark .nav-item.active .count {
  background: rgba(165, 180, 252, 0.2);
  color: #a5b4fc;
}

.nav-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-toolbar-border);
}

.nav-section.bottom {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-toolbar-border);
}

.nav-section-header {
  padding: 0 12px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
}

.nav-item.add-folder {
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-toolbar-border);
  background: transparent;
  margin-top: 4px;
}

.nav-item.add-folder::before {
  display: none;
}

.nav-item.add-folder:hover {
  color: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.05);
}

.nav-item.add-folder :deep(svg) {
  width: 14px;
  height: 14px;
}

/* ============================================
   MAIN CONTENT
   ============================================ */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, 
    transparent 0%, 
    rgba(99, 102, 241, 0.01) 100%
  );
}

.content-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
  background: linear-gradient(180deg, 
    rgba(99, 102, 241, 0.03) 0%, 
    transparent 100%
  );
}

.header-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.folder-indicator {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.3px;
}

.back-btn,
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-btn:hover,
.close-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.close-btn:hover {
  transform: rotate(90deg);
}

.close-btn:active {
  transform: rotate(90deg) scale(0.9);
}

.mobile-only {
  display: none;
}

/* ============================================
   TOOLBAR
   ============================================ */
.content-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-box:focus-within {
  border-color: var(--color-accent-primary);
  background: var(--color-toolbar-bg-solid);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.search-box:focus-within .search-icon {
  color: var(--color-accent-primary);
}

.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  outline: none;
}

.search-box input::placeholder {
  color: var(--color-text-tertiary);
  font-weight: 400;
}

.clear-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--color-toolbar-active);
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: var(--color-text-tertiary);
  color: var(--color-toolbar-bg-solid);
  transform: scale(1.1);
}

.clear-search :deep(svg) {
  width: 10px;
  height: 10px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-dropdown {
  display: flex;
  align-items: center;
}

.toolbar-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-hover);
  border: none;
  border-radius: 10px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-btn:hover {
  background: var(--color-toolbar-active);
  color: var(--color-accent-primary);
  transform: scale(1.05);
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.sort-select {
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.sort-select:hover {
  background: var(--color-toolbar-hover);
}

.view-toggle {
  display: flex;
  background: var(--color-toolbar-hover);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}

.toggle-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn:hover {
  color: var(--color-text-secondary);
}

.toggle-btn.active {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-accent-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.toggle-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

/* ============================================
   QUICK ACTIONS
   ============================================ */
.quick-actions {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.quick-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.quick-action-btn:hover {
  background: var(--color-toolbar-active);
  border-color: var(--color-toolbar-border);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.quick-action-btn:active {
  transform: translateY(0);
}

.quick-action-btn.primary {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border: none;
  position: relative;
  overflow: hidden;
}

.quick-action-btn.primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.quick-action-btn.primary:hover {
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.quick-action-btn.primary:hover::before {
  opacity: 1;
}

.quick-action-btn.primary .action-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(8px);
}

.quick-action-btn.primary .action-label,
.quick-action-btn.primary .action-hint {
  color: white;
  position: relative;
  z-index: 1;
}

.quick-action-btn.primary .action-hint {
  opacity: 0.85;
}

.action-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border-radius: 8px;
  color: var(--color-accent-primary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.quick-action-btn:hover .action-icon {
  transform: scale(1.05);
}

.action-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.action-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* ============================================
   TRASH ACTIONS
   ============================================ */
.trash-actions {
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
  background: linear-gradient(180deg, 
    rgba(239, 68, 68, 0.03) 0%, 
    transparent 100%
  );
}

.empty-trash-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-trash-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.empty-trash-btn:active {
  transform: translateY(0);
}

.empty-trash-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.trash-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

/* ============================================
   PROJECTS CONTAINER
   ============================================ */
.projects-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-text-tertiary) transparent;
}

.projects-container::-webkit-scrollbar {
  width: 6px;
}

.projects-container::-webkit-scrollbar-track {
  background: transparent;
}

.projects-container::-webkit-scrollbar-thumb {
  background: var(--color-text-tertiary);
  border-radius: 3px;
}

/* ============================================
   LOADING & EMPTY STATES
   ============================================ */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-toolbar-border);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 18px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state span {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.empty-illustration {
  margin-bottom: 20px;
  position: relative;
}

.empty-illustration::before {
  content: '';
  position: absolute;
  inset: -20px;
  background: radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%);
  opacity: 0.5;
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.3; transform: scale(0.95); }
  50% { opacity: 0.5; transform: scale(1.05); }
}

.empty-icon {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, 
    var(--color-toolbar-hover) 0%, 
    var(--color-toolbar-active) 100%
  );
  border-radius: 18px;
  color: var(--color-text-tertiary);
  border: 1px solid var(--color-toolbar-border);
}

.empty-icon :deep(svg) {
  width: 32px;
  height: 32px;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}

.empty-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 260px;
  line-height: 1.5;
}

/* ============================================
   PROJECTS GRID
   ============================================ */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.project-card {
  position: relative;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  animation: cardIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) backwards;
  animation-delay: var(--delay);
  overflow: hidden;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.project-card:hover {
  border-color: var(--color-accent-primary);
  transform: translateY(-4px);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(99, 102, 241, 0.1);
}

.dark .project-card:hover {
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(99, 102, 241, 0.2);
}

.project-card.active {
  border-color: var(--color-accent-primary);
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.08) 0%, 
    rgba(99, 102, 241, 0.04) 100%
  );
}

.project-card.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

/* ============================================
   THUMBNAIL
   ============================================ */
.project-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--color-toolbar-bg-solid);
  overflow: hidden;
}

.project-thumbnail.dark {
  background: #1a1a1a;
}

.project-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.project-card:hover .project-thumbnail img {
  transform: scale(1.03);
}

/* Invert thumbnail colors when project theme doesn't match current app theme */
.project-thumbnail.invert-for-theme {
  /* Override background to match current theme instead of saved theme */
  background: var(--color-toolbar-bg-solid) !important;
}

.project-thumbnail.invert-for-theme img {
  filter: invert(1) hue-rotate(180deg);
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, 
    var(--color-toolbar-hover) 0%, 
    var(--color-toolbar-active) 100%
  );
}

.placeholder-pattern {
  position: relative;
  width: 60%;
  height: 60%;
  opacity: 0.15;
}

.pattern-shape {
  position: absolute;
  background: var(--color-text-secondary);
  transition: all 0.3s ease;
}

.project-card:hover .pattern-shape {
  opacity: 0.25;
}

.pattern-shape.rect {
  width: 40%;
  height: 30%;
  left: 10%;
  top: 15%;
  border-radius: 4px;
}

.pattern-shape.circle {
  width: 30%;
  height: 45%;
  right: 15%;
  top: 20%;
  border-radius: 50%;
}

.pattern-shape.line {
  width: 60%;
  height: 4px;
  left: 20%;
  bottom: 20%;
  border-radius: 2px;
}

.star-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 8px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.project-card:hover .star-btn {
  opacity: 1;
  transform: scale(1);
}

.star-btn:hover {
  color: #eab308;
  transform: scale(1.1);
}

.star-btn.starred {
  color: #eab308;
  opacity: 1;
  transform: scale(1);
}

.star-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 7px;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.45);
  letter-spacing: 0.3px;
}

.active-badge :deep(svg) {
  width: 10px;
  height: 10px;
}

/* ============================================
   PROJECT INFO
   ============================================ */
.project-info {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  letter-spacing: -0.1px;
}

.project-name-input {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 2px solid var(--color-accent-primary);
  border-radius: 8px;
  padding: 6px 10px;
  width: 100%;
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 2px;
}

.more-tags {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  padding: 2px 5px;
  background: var(--color-toolbar-hover);
  border-radius: 4px;
}

.project-date {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.date-icon {
  width: 12px;
  height: 12px;
  opacity: 0.6;
}

/* ============================================
   ACTIONS OVERLAY
   ============================================ */
.project-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transform: translateY(-6px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.project-actions.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: all;
}

.project-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
}

.project-action-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-accent-primary);
  transform: scale(1.1);
}

.project-action-btn:active {
  transform: scale(0.95);
}

.project-action-btn.active {
  color: var(--color-accent-primary);
}

.project-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.dark .project-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
}

.project-action-btn :deep(svg) {
  width: 13px;
  height: 13px;
}

/* ============================================
   LIST VIEW
   ============================================ */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-list-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.project-list-item:hover {
  background: var(--color-toolbar-hover);
  border-color: var(--color-toolbar-border);
}

.project-list-item.active {
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.08) 0%, 
    rgba(99, 102, 241, 0.04) 100%
  );
  border-color: rgba(99, 102, 241, 0.2);
}

.project-list-item.dragging {
  opacity: 0.5;
}

.list-thumbnail {
  width: 52px;
  height: 34px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-toolbar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  border: 1px solid var(--color-toolbar-border);
  transition: all 0.2s ease;
}

.project-list-item:hover .list-thumbnail {
  border-color: var(--color-accent-primary);
}

.list-thumbnail.dark {
  background: #1a1a1a;
}

.list-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Invert list thumbnail colors when project theme doesn't match current app theme */
.list-thumbnail.invert-for-theme {
  background: var(--color-toolbar-bg-solid) !important;
}

.list-thumbnail.invert-for-theme img {
  filter: invert(1) hue-rotate(180deg);
}

.list-thumbnail :deep(svg) {
  width: 16px;
  height: 16px;
}

.list-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.1px;
}

.list-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.list-tags {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.list-star {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-star:hover {
  background: var(--color-toolbar-active);
  color: #eab308;
  transform: scale(1.1);
}

.list-star.starred {
  color: #eab308;
}

.list-star :deep(svg) {
  width: 16px;
  height: 16px;
}

.list-actions {
  display: none;
  gap: 5px;
}

.project-list-item:hover .list-actions {
  display: flex;
}

.action-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  background: var(--color-toolbar-active);
  color: var(--color-accent-primary);
  transform: scale(1.05);
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn.active {
  color: var(--color-accent-primary);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.action-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

/* ============================================
   CURRENT PROJECT FOOTER
   ============================================ */
.current-project-footer {
  border-top: 1px solid var(--color-toolbar-border);
  background: linear-gradient(180deg, 
    var(--color-toolbar-hover) 0%, 
    rgba(99, 102, 241, 0.03) 100%
  );
  flex-shrink: 0;
}

.footer-inner {
  padding: 14px 20px;
}

.current-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.current-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 10px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.3);
}

.current-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.current-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.current-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  max-width: fit-content;
  letter-spacing: -0.1px;
}

.current-name:hover {
  background: var(--color-toolbar-active);
}

.edit-hint {
  width: 12px;
  height: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: var(--color-text-tertiary);
}

.current-name:hover .edit-hint {
  opacity: 0.6;
}

.current-name-input {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 2px solid var(--color-accent-primary);
  border-radius: 8px;
  padding: 6px 10px;
  outline: none;
  width: 100%;
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.sync-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.sync-status.saving {
  color: var(--color-accent-primary);
}

.sync-status.saved {
  color: #22c55e;
}

.sync-dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent-primary);
  border-radius: 50%;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.sync-icon {
  width: 13px;
  height: 13px;
}

/* Tag Picker Overlay */
.tag-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.tag-picker-container {
  animation: fadeIn 0.15s ease;
}

/* ============================================
   TAG PICKER OVERLAY
   ============================================ */
.tag-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tag-picker-container {
  animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* ============================================
   MOBILE RESPONSIVE
   ============================================ */
@media (max-width: 720px) {
  .drawer {
    width: 100%;
  }
  
  .sidebar {
    display: none;
  }
  
  .mobile-only {
    display: flex;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .content-header {
    padding: 14px 16px;
  }
  
  .content-toolbar {
    padding: 12px 16px;
  }
  
  .quick-actions {
    padding: 12px 16px;
  }
  
  .projects-container {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .quick-actions {
    flex-direction: column;
    gap: 10px;
  }
  
  .content-toolbar {
    flex-wrap: wrap;
  }
  
  .search-box {
    width: 100%;
    order: 1;
  }
  
  .toolbar-actions {
    order: 0;
    margin-left: auto;
  }
  
  .header-title h2 {
    font-size: 16px;
  }
}

/* ============================================
   REDUCED MOTION
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  .drawer-overlay,
  .drawer,
  .project-card,
  .project-list-item,
  .nav-item,
  .quick-action-btn,
  .star-btn,
  .project-action-btn,
  .action-btn,
  .toggle-btn,
  .toolbar-btn,
  .close-btn,
  .search-box,
  .tag-picker-container {
    transition: none;
    animation: none;
  }
  
  .spinner,
  .sync-dot {
    animation: none;
  }
  
  .empty-illustration::before {
    animation: none;
  }
  
  .project-card:hover .project-thumbnail img {
    transform: none;
  }
}
</style>
