<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjectsStore, type ProjectListItem } from '../../stores/projects'
import { useFoldersStore } from '../../stores/folders'
import { useTagsStore } from '../../stores/tags'
import { useAuthStore } from '../../stores/auth'
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

onMounted(async () => {
  await Promise.all([
    projectsStore.fetchProjects(),
    foldersStore.fetchFolders(),
    tagsStore.fetchTags(),
  ])
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
  emit('close')
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
  <div class="drawer-overlay" @click.self="emit('close')">
    <div class="drawer">
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
          <button class="back-btn mobile-only" @click="emit('close')">
            <ToolIcon name="chevronLeft" />
          </button>

          <div class="header-title">
            <span v-if="currentFolderColor" class="folder-indicator" :style="{ background: currentFolderColor }" />
            <h2>{{ currentViewTitle }}</h2>
          </div>

          <button class="close-btn" @click="emit('close')">
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
              <div class="project-thumbnail" :class="{ dark: project.isDarkTheme }">
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
              <div class="list-thumbnail" :class="{ dark: project.isDarkTheme }">
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

              <!-- Star -->
              <button
                v-if="!project.isTrashed"
                class="list-star"
                :class="{ starred: project.isStarred }"
                @click.stop="handleToggleStar(project)"
              >
                <ToolIcon :name="project.isStarred ? 'starFilled' : 'star'" />
              </button>

              <!-- Actions -->
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
                  <button class="action-btn" @click="startRenaming(project)">
                    <ToolIcon name="pencil" />
                  </button>
                  <button class="action-btn" @click="handleDuplicate(project)">
                    <ToolIcon name="copy" />
                  </button>
                  <button class="action-btn delete" @click="handleDeleteClick(project)">
                    <ToolIcon name="trash" />
                  </button>
                </template>
              </div>
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
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-start;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer {
  display: flex;
  width: 720px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-toolbar-bg-solid);
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 8px 0 40px rgba(0, 0, 0, 0.3);
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Sidebar */
.sidebar {
  width: 220px;
  border-right: 1px solid var(--color-toolbar-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.nav-item:hover {
  background: var(--color-toolbar-hover);
}

.nav-item.active {
  background: var(--color-toolbar-active);
  color: var(--color-accent-primary);
}

.nav-item :deep(svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.nav-item .count {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-toolbar-hover);
  padding: 2px 6px;
  border-radius: 10px;
}

.nav-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-toolbar-border);
}

.nav-section.bottom {
  margin-top: auto;
}

.nav-section-header {
  padding: 0 10px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-tertiary);
}

.nav-item.add-folder {
  color: var(--color-text-secondary);
}

.nav-item.add-folder:hover {
  color: var(--color-accent-primary);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.header-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.folder-indicator {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.header-title h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
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
  transition: all 0.15s ease;
}

.back-btn:hover,
.close-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.mobile-only {
  display: none;
}

/* Toolbar */
.content-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 10px;
  transition: all 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--color-accent-primary);
  background: var(--color-toolbar-bg-solid);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
}

.search-box input::placeholder {
  color: var(--color-text-tertiary);
}

.clear-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: var(--color-toolbar-active);
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-search:hover {
  background: var(--color-text-tertiary);
  color: var(--color-toolbar-bg-solid);
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
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-hover);
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.sort-select {
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
}

.view-toggle {
  display: flex;
  background: var(--color-toolbar-hover);
  border-radius: 8px;
  padding: 2px;
}

.toggle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-btn:hover {
  color: var(--color-text-secondary);
}

.toggle-btn.active {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
}

.toggle-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.quick-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.quick-action-btn:hover {
  background: var(--color-toolbar-active);
  border-color: var(--color-toolbar-border);
}

.quick-action-btn.primary {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border: none;
}

.quick-action-btn.primary:hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
}

.quick-action-btn.primary .action-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.quick-action-btn.primary .action-label,
.quick-action-btn.primary .action-hint {
  color: white;
}

.quick-action-btn.primary .action-hint {
  opacity: 0.8;
}

.action-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border-radius: 6px;
  color: var(--color-accent-primary);
  flex-shrink: 0;
}

.action-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.action-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-hint {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* Trash actions */
.trash-actions {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.empty-trash-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.empty-trash-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.trash-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* Projects Container */
.projects-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-toolbar-border);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state span {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.empty-illustration {
  margin-bottom: 16px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-hover);
  border-radius: 16px;
  color: var(--color-text-tertiary);
}

.empty-icon :deep(svg) {
  width: 28px;
  height: 28px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.empty-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.project-card {
  position: relative;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: cardIn 0.3s ease backwards;
  animation-delay: var(--delay);
  overflow: hidden;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.project-card:hover {
  border-color: var(--color-toolbar-border);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.project-card.active {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.08);
}

.project-card.dragging {
  opacity: 0.5;
}

/* Thumbnail */
.project-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--color-toolbar-bg-solid);
  overflow: hidden;
}

.project-thumbnail.dark {
  background: #1e1e1e;
}

.project-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-toolbar-hover), var(--color-toolbar-active));
}

.placeholder-pattern {
  position: relative;
  width: 60%;
  height: 60%;
  opacity: 0.2;
}

.pattern-shape {
  position: absolute;
  background: var(--color-text-secondary);
}

.pattern-shape.rect {
  width: 40%;
  height: 30%;
  left: 10%;
  top: 15%;
  border-radius: 3px;
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
  height: 3px;
  left: 20%;
  bottom: 20%;
  border-radius: 2px;
}

.star-btn {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.project-card:hover .star-btn {
  opacity: 1;
}

.star-btn:hover {
  color: #eab308;
}

.star-btn.starred {
  color: #eab308;
  opacity: 1;
}

.star-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.active-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-accent-primary);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
}

.active-badge :deep(svg) {
  width: 10px;
  height: 10px;
}

/* Project Info */
.project-info {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.project-name-input {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-accent-primary);
  border-radius: 6px;
  padding: 4px 8px;
  width: 100%;
  outline: none;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.more-tags {
  font-size: 10px;
  color: var(--color-text-tertiary);
  padding: 2px 4px;
}

.project-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.date-icon {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

/* Actions Overlay */
.project-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.15s ease;
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
  width: 26px;
  height: 26px;
  border: none;
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.project-action-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  transform: scale(1.05);
}

.project-action-btn.delete:hover {
  background: #fee2e2;
  color: #ef4444;
}

.dark .project-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* List View */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-list-item:hover {
  background: var(--color-toolbar-hover);
}

.project-list-item.active {
  background: rgba(99, 102, 241, 0.1);
}

.project-list-item.dragging {
  opacity: 0.5;
}

.list-thumbnail {
  width: 48px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-toolbar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.list-thumbnail.dark {
  background: #1e1e1e;
}

.list-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  gap: 2px;
}

.list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.list-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.list-star {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.list-star:hover {
  background: var(--color-toolbar-active);
  color: #eab308;
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
  gap: 4px;
}

.project-list-item:hover .list-actions {
  display: flex;
}

.project-list-item:hover .list-star:not(.starred) {
  display: none;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.action-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

/* Current Project Footer */
.current-project-footer {
  border-top: 1px solid var(--color-toolbar-border);
  background: var(--color-toolbar-hover);
  flex-shrink: 0;
}

.footer-inner {
  padding: 12px 20px;
}

.current-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
}

.current-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.current-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: pointer;
  padding: 2px 6px;
  margin: -2px -6px;
  border-radius: 6px;
  transition: background 0.15s ease;
  max-width: fit-content;
}

.current-name:hover {
  background: var(--color-toolbar-active);
}

.edit-hint {
  width: 12px;
  height: 12px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.current-name:hover .edit-hint {
  opacity: 0.5;
}

.current-name-input {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-accent-primary);
  border-radius: 6px;
  padding: 4px 8px;
  outline: none;
  width: 100%;
}

.sync-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
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
  50% { opacity: 0.5; transform: scale(0.9); }
}

.sync-icon {
  width: 12px;
  height: 12px;
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

/* Mobile Responsive */
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
}

@media (max-width: 480px) {
  .quick-actions {
    flex-direction: column;
  }
  
  .content-toolbar {
    flex-wrap: wrap;
  }
  
  .search-box {
    width: 100%;
  }
}
</style>
