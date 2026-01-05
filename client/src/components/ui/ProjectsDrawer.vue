<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectsStore, type ProjectListItem } from '../../stores/projects'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const projectsStore = useProjectsStore()

const showDeleteConfirm = ref(false)
const projectToDelete = ref<ProjectListItem | null>(null)
const editingProjectId = ref<string | null>(null)
const editingName = ref('')
const editingCurrentName = ref(false)
const currentNameInput = ref('')

onMounted(() => {
  projectsStore.fetchProjects()
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

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

function handleDeleteClick(project: ProjectListItem) {
  projectToDelete.value = project
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (projectToDelete.value) {
    await projectsStore.deleteProject(projectToDelete.value.id)
  }
  showDeleteConfirm.value = false
  projectToDelete.value = null
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
    // Update locally first
    const index = projectsStore.projects.findIndex(p => p.id === project.id)
    if (index !== -1) {
      projectsStore.projects[index].name = editingName.value.trim()
    }
    
    // If this is the current project, update the name and save
    if (project.id === projectsStore.currentProjectId) {
      projectsStore.renameProject(editingName.value.trim())
    } else {
      // For non-current projects, need to update on server directly
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      await fetch(`${API_URL}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    
    // Also update in the list
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
</script>

<template>
  <div class="drawer-overlay" @click.self="emit('close')">
    <div class="drawer">
      <!-- Header -->
      <div class="drawer-header">
        <h2 class="drawer-title">
          <ToolIcon name="folder" class="title-icon" />
          My Projects
        </h2>
        <button class="close-btn" @click="emit('close')">
          <ToolIcon name="close" />
        </button>
      </div>

      <!-- Actions bar -->
      <div class="actions-bar">
        <button class="action-btn primary" @click="handleCreateProject">
          <ToolIcon name="plus" />
          <span>Save current as new</span>
        </button>
        <button class="action-btn" @click="handleNewProject">
          <ToolIcon name="plus" />
          <span>New blank project</span>
        </button>
      </div>

      <!-- Projects list -->
      <div class="projects-list">
        <div v-if="projectsStore.isLoading" class="loading-state">
          <div class="spinner" />
          <span>Loading projects...</span>
        </div>

        <div v-else-if="projectsStore.projects.length === 0" class="empty-state">
          <ToolIcon name="folderOpen" class="empty-icon" />
          <p>No projects yet</p>
          <p class="empty-hint">Save your current work to the cloud</p>
        </div>

        <div v-else class="projects-grid">
          <div
            v-for="project in projectsStore.projects"
            :key="project.id"
            :class="['project-card', { active: project.id === projectsStore.currentProjectId }]"
            @click="handleLoadProject(project)"
          >
            <!-- Thumbnail -->
            <div class="project-thumbnail">
              <img v-if="project.thumbnail" :src="project.thumbnail" :alt="project.name" />
              <div v-else class="thumbnail-placeholder">
                <ToolIcon name="image" />
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
                  ref="renameInput"
                  autofocus
                />
              </template>
              <template v-else>
                <span class="project-name" @click="handleLoadProject(project)">{{ project.name }}</span>
              </template>
              <span class="project-date">{{ formatDate(project.updatedAt) }}</span>
            </div>

            <!-- Actions -->
            <div class="project-actions" @click.stop>
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
            </div>
          </div>
        </div>
      </div>

      <!-- Current project indicator -->
      <div v-if="projectsStore.isCloudProject" class="current-project-bar">
        <ToolIcon name="cloud" class="cloud-icon" />
        <span class="current-label">Current:</span>
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
          <span class="current-name" @click="startEditingCurrentName" title="Click to rename">
            {{ projectsStore.currentProjectName }}
          </span>
          <button class="edit-name-btn" @click="startEditingCurrentName" v-tooltip.top="'Rename'">
            <ToolIcon name="pencil" />
          </button>
        </template>
        <span v-if="projectsStore.isSaving" class="save-status saving">Saving...</span>
        <span v-else-if="projectsStore.lastSavedAt" class="save-status saved">
          Saved {{ formatDate(projectsStore.lastSavedAt) }}
        </span>
      </div>
    </div>
  </div>

  <!-- Delete confirmation modal -->
  <ConfirmModal
    v-if="showDeleteConfirm"
    title="Delete project"
    :message="`Are you sure you want to delete '${projectToDelete?.name}'? This action cannot be undone.`"
    confirm-text="Delete"
    cancel-text="Cancel"
    :danger="true"
    @confirm="handleDeleteConfirm"
    @cancel="showDeleteConfirm = false"
  />
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer {
  width: 400px;
  max-width: 90vw;
  height: 100%;
  background: var(--color-toolbar-bg-solid);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.title-icon {
  width: 20px;
  height: 20px;
  color: var(--color-accent-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.actions-bar {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-toolbar-border);
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-toolbar-hover);
  border-color: var(--color-accent-primary);
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border: none;
  color: white;
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.projects-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-secondary);
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-toolbar-border);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.empty-hint {
  font-size: 13px;
  opacity: 0.7;
}

.projects-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-card:hover {
  border-color: var(--color-toolbar-border);
}

.project-card.active {
  border-color: var(--color-accent-primary);
  background: rgba(59, 130, 246, 0.1);
}

.project-thumbnail {
  width: 64px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-toolbar-bg-solid);
  flex-shrink: 0;
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
  color: var(--color-text-secondary);
  opacity: 0.3;
}

.project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.project-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.project-name-input {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-accent-primary);
  border-radius: 4px;
  padding: 2px 6px;
  width: 100%;
  outline: none;
}

.project-date {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.project-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.project-card:hover .project-actions {
  opacity: 1;
}

.project-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.project-action-btn:hover {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
}

.project-action-btn.delete:hover {
  color: #ef4444;
}

.current-project-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--color-toolbar-hover);
  border-top: 1px solid var(--color-toolbar-border);
  font-size: 13px;
}

.cloud-icon {
  width: 16px;
  height: 16px;
  color: var(--color-accent-primary);
}

.current-label {
  color: var(--color-text-secondary);
}

.current-name {
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.current-name:hover {
  background: var(--color-toolbar-bg-solid);
}

.current-name-input {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-accent-primary);
  border-radius: 4px;
  padding: 2px 8px;
  flex: 1;
  outline: none;
  min-width: 0;
}

.edit-name-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.edit-name-btn:hover {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
}

.save-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.save-status.saving {
  color: var(--color-accent-primary);
  background: rgba(59, 130, 246, 0.1);
}

.save-status.saved {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}
</style>

