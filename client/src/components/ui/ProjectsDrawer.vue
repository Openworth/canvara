<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjectsStore, type ProjectListItem } from '../../stores/projects'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const projectsStore = useProjectsStore()
const authStore = useAuthStore()

const showDeleteConfirm = ref(false)
const projectToDelete = ref<ProjectListItem | null>(null)
const editingProjectId = ref<string | null>(null)
const editingName = ref('')
const editingCurrentName = ref(false)
const currentNameInput = ref('')
const hoveredProjectId = ref<string | null>(null)

onMounted(() => {
  projectsStore.fetchProjects()
})

const sortedProjects = computed(() => {
  return [...projectsStore.projects].sort((a, b) => b.updatedAt - a.updatedAt)
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
</script>

<template>
  <div class="drawer-overlay" @click.self="emit('close')">
    <div class="drawer">
      <!-- Header -->
      <div class="drawer-header">
        <button class="back-btn" @click="emit('close')">
          <ToolIcon name="chevronLeft" />
        </button>
        <h2 class="drawer-title">My Projects</h2>
        <button class="close-btn" @click="emit('close')">
          <ToolIcon name="close" />
        </button>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
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

      <!-- Projects Grid -->
      <div class="projects-container">
        <div v-if="projectsStore.isLoading" class="loading-state">
          <div class="spinner" />
          <span>Loading your projects...</span>
        </div>

        <div v-else-if="sortedProjects.length === 0" class="empty-state">
          <div class="empty-illustration">
            <div class="empty-icon">
              <ToolIcon name="folderOpen" />
            </div>
            <div class="empty-shapes">
              <div class="shape shape-1"></div>
              <div class="shape shape-2"></div>
              <div class="shape shape-3"></div>
            </div>
          </div>
          <h3 class="empty-title">No projects yet</h3>
          <p class="empty-description">Your saved projects will appear here. Start by saving your current canvas!</p>
        </div>

        <div v-else class="projects-grid">
          <div
            v-for="(project, index) in sortedProjects"
            :key="project.id"
            :class="['project-card', { active: project.id === projectsStore.currentProjectId }]"
            :style="{ '--delay': `${index * 0.03}s` }"
            @click="handleLoadProject(project)"
            @mouseenter="hoveredProjectId = project.id"
            @mouseleave="hoveredProjectId = null"
          >
            <!-- Thumbnail -->
            <div class="project-thumbnail">
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
  width: 380px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-toolbar-bg-solid);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 8px 0 40px rgba(0, 0, 0, 0.3);
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Header */
.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
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

.drawer-title {
  flex: 1;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.quick-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.quick-action-btn:hover {
  background: var(--color-toolbar-active);
  border-color: var(--color-toolbar-border);
  transform: translateY(-1px);
}

.quick-action-btn.primary {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border: none;
}

.quick-action-btn.primary:hover {
  transform: translateY(-1px);
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
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border-radius: 8px;
  color: var(--color-accent-primary);
  flex-shrink: 0;
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

/* Projects Container */
.projects-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
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
  width: 36px;
  height: 36px;
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
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
}

.empty-icon {
  position: relative;
  z-index: 1;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-toolbar-hover), var(--color-toolbar-active));
  border-radius: 20px;
  color: var(--color-text-tertiary);
}

.empty-icon :deep(svg) {
  width: 36px;
  height: 36px;
}

.empty-shapes {
  position: absolute;
  inset: -10px;
  pointer-events: none;
}

.shape {
  position: absolute;
  background: var(--color-accent-primary);
  opacity: 0.15;
}

.shape-1 {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  top: -5px;
  right: 5px;
  animation: float 3s ease-in-out infinite;
}

.shape-2 {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  bottom: 10px;
  left: -5px;
  transform: rotate(45deg);
  animation: float 3s ease-in-out infinite 0.5s;
}

.shape-3 {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  bottom: -3px;
  right: 15px;
  animation: float 3s ease-in-out infinite 1s;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.empty-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
  max-width: 240px;
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
  border-radius: 14px;
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

.dark .project-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* Thumbnail */
.project-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--color-toolbar-bg-solid);
  border-radius: 10px 10px 0 0;
  overflow: hidden;
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
  background: linear-gradient(135deg, 
    var(--color-toolbar-hover) 0%, 
    var(--color-toolbar-active) 100%
  );
}

.placeholder-pattern {
  position: relative;
  width: 60%;
  height: 60%;
  opacity: 0.25;
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

.active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
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
  padding: 10px 12px 12px;
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
  left: 6px;
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
  width: 28px;
  height: 28px;
  border: none;
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-secondary);
  border-radius: 7px;
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

/* Current Project Footer */
.current-project-footer {
  border-top: 1px solid var(--color-toolbar-border);
  background: var(--color-toolbar-hover);
}

.footer-inner {
  padding: 14px 20px;
}

.current-info {
  display: flex;
  align-items: center;
  gap: 12px;
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
  font-size: 14px;
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
  font-size: 14px;
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
  50% { opacity: 0.5; transform: scale(0.9); }
}

.sync-icon {
  width: 12px;
  height: 12px;
}

/* Mobile Responsive */
@media (max-width: 480px) {
  .drawer {
    width: 100%;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-actions {
    flex-direction: column;
  }
}
</style>
