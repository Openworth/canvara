<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'
import { useProjectsStore, type ProjectListItem } from '../../stores/projects'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'

const props = defineProps<{
  isMobile?: boolean
}>()

const emit = defineEmits<{
  close: []
  export: []
  share: []
  clearCanvas: []
  openUpgrade: []
}>()

const appStore = useAppStore()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()

// View state: 'menu' or 'projects'
const currentView = ref<'menu' | 'projects'>('menu')

// Projects-related state
const showDeleteConfirm = ref(false)
const projectToDelete = ref<ProjectListItem | null>(null)
const editingProjectId = ref<string | null>(null)
const editingName = ref('')

function handleClearCanvas() {
  emit('clearCanvas')
  emit('close')
}

function handleExport() {
  emit('export')
  emit('close')
}

function handleShare() {
  emit('share')
  emit('close')
}

function handleToggleTheme() {
  appStore.toggleDarkMode()
}

function handleLogin() {
  authStore.login()
  emit('close')
}

function handleLogout() {
  authStore.logout()
  emit('close')
}

function handleOpenProjects() {
  currentView.value = 'projects'
  projectsStore.fetchProjects()
}

function handleBackToMenu() {
  currentView.value = 'menu'
}

function handleOpenUpgrade() {
  emit('openUpgrade')
  emit('close')
}

// Projects functions
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

interface MenuItem {
  label: string
  icon: string
  shortcut?: string
  action: () => void
  danger?: boolean
  mobileOnly?: boolean
}

const menuItems: MenuItem[] = [
  {
    label: 'Share',
    icon: 'share',
    action: handleShare,
    mobileOnly: true,
  },
  {
    label: 'Export',
    icon: 'download',
    action: handleExport,
  },
  {
    label: 'Clear canvas',
    icon: 'trash',
    action: handleClearCanvas,
    danger: true,
  },
]

// Filter items based on mobile/desktop
const visibleItems = computed(() => 
  props.isMobile 
    ? menuItems 
    : menuItems.filter(item => !item.mobileOnly)
)
</script>

<template>
  <Teleport to="body">
    <div class="drawer-overlay" @click.self="emit('close')">
      <div class="drawer-panel">
        <!-- View container with sliding animation -->
        <div class="views-container" :class="{ 'show-projects': currentView === 'projects' }">
          
          <!-- Main Menu View -->
          <div class="view menu-view">
            <!-- Header -->
            <div class="drawer-header">
              <div class="drawer-brand">
                <img :src="appStore.isDarkMode ? '/logo-full.svg' : '/logo-full-light.svg'" alt="Canvara" class="drawer-logo" />
              </div>
              <button class="drawer-close" @click="emit('close')">
                <ToolIcon name="close" />
              </button>
            </div>

            <!-- User section (when authenticated) -->
            <template v-if="authStore.isAuthenticated">
              <div class="user-section">
                <img
                  v-if="authStore.user?.avatarUrl"
                  :src="authStore.user.avatarUrl"
                  :alt="authStore.displayName || 'User'"
                  class="user-avatar"
                />
                <span v-else class="user-avatar-initials">
                  {{ authStore.initials }}
                </span>
                <div class="user-details">
                  <span class="user-name">{{ authStore.displayName }}</span>
                  <span class="user-email">{{ authStore.user?.email }}</span>
                </div>
                <span :class="['plan-badge', authStore.isPaidUser ? (authStore.isSubscriptionCanceled ? 'canceled' : 'pro') : 'free']">
                  {{ authStore.isPaidUser ? 'Pro' : 'Free' }}
                </span>
              </div>

              <!-- Cancellation notice -->
              <div v-if="authStore.isSubscriptionCanceled" class="cancel-notice">
                <ToolIcon name="zap" class="cancel-icon" />
                <div class="cancel-text">
                  <span class="cancel-title">Subscription ending</span>
                  <span class="cancel-date">Access until {{ authStore.subscriptionEndDateFormatted }}</span>
                </div>
              </div>
            </template>

          <!-- Sign in prompt (when not authenticated) -->
          <template v-else>
            <div class="signin-section">
              <div class="signin-prompt">
                <ToolIcon name="users" class="signin-icon" />
                <span class="signin-text">Sign in to save your work and access Pro features</span>
              </div>
              <button class="google-signin-btn" @click="handleLogin">
                <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          </template>

            <!-- Menu content -->
            <div class="drawer-content">
              <!-- Canvas section -->
              <div class="menu-section">
                <span class="section-label">Canvas</span>
                <button
                  v-for="item in visibleItems"
                  :key="item.label"
                  class="menu-item"
                  :class="{ 'danger': item.danger }"
                  @click="item.action"
                >
                  <ToolIcon :name="item.icon" />
                  <span>{{ item.label }}</span>
                </button>
              </div>

              <!-- Preferences section -->
              <div class="menu-section">
                <span class="section-label">Preferences</span>
                <button class="menu-item toggle-item" @click="handleToggleTheme">
                  <ToolIcon :name="appStore.isDarkMode ? 'moon' : 'sun'" />
                  <span>Dark mode</span>
                  <div class="toggle-switch" :class="{ active: appStore.isDarkMode }">
                    <div class="toggle-thumb" />
                  </div>
                </button>
              </div>

              <!-- Account section (authenticated) -->
              <template v-if="authStore.isAuthenticated">
                <div class="menu-section">
                  <span class="section-label">Account</span>
                  
                  <button 
                    v-if="authStore.isPaidUser" 
                    class="menu-item nav-item"
                    @click="handleOpenProjects"
                  >
                    <ToolIcon name="folder" />
                    <span>My Projects</span>
                    <ToolIcon name="chevronUp" class="nav-arrow" />
                  </button>

                  <button 
                    v-if="!authStore.isPaidUser" 
                    class="menu-item upgrade-item"
                    @click="handleOpenUpgrade"
                  >
                    <ToolIcon name="zap" />
                    <span>Upgrade to Pro</span>
                    <span class="upgrade-price">$5/mo</span>
                  </button>

                  <button 
                    v-if="authStore.isPaidUser" 
                    class="menu-item"
                    @click="handleOpenUpgrade"
                  >
                    <ToolIcon name="creditCard" />
                    <span>Manage Subscription</span>
                  </button>
                </div>
              </template>
            </div>

            <!-- Footer -->
            <div class="drawer-footer">
              <template v-if="authStore.isAuthenticated">
                <button class="menu-item logout-item" @click="handleLogout">
                  <ToolIcon name="logOut" />
                  <span>Sign out</span>
                </button>
              </template>
              <div class="footer-meta">
                <span class="version">Canvara v1.0</span>
              </div>
            </div>
          </div>

          <!-- Projects View -->
          <div class="view projects-view">
            <!-- Header with back button -->
            <div class="drawer-header">
              <button class="back-btn" @click="handleBackToMenu">
                <ToolIcon name="chevronUp" class="back-arrow" />
                <span>My Projects</span>
              </button>
              <button class="drawer-close" @click="emit('close')">
                <ToolIcon name="close" />
              </button>
            </div>

            <!-- Actions bar -->
            <div class="actions-bar">
              <button class="action-btn primary" @click="handleCreateProject">
                <ToolIcon name="plus" />
                <span>Save current</span>
              </button>
              <button class="action-btn" @click="handleNewProject">
                <ToolIcon name="plus" />
                <span>New blank</span>
              </button>
            </div>

            <!-- Projects list -->
            <div class="projects-content">
              <div v-if="projectsStore.isLoading" class="loading-state">
                <div class="spinner" />
                <span>Loading...</span>
              </div>

              <div v-else-if="projectsStore.projects.length === 0" class="empty-state">
                <ToolIcon name="folderOpen" class="empty-icon" />
                <p>No projects yet</p>
                <p class="empty-hint">Save your current work to the cloud</p>
              </div>

              <div v-else class="projects-list">
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
              <span class="current-name">{{ projectsStore.currentProjectName }}</span>
              <span v-if="projectsStore.isSaving" class="save-status saving">Saving...</span>
              <span v-else-if="projectsStore.lastSavedAt" class="save-status saved">Saved</span>
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
  </Teleport>
</template>

<style scoped>
/* Overlay */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Panel */
.drawer-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 320px;
  max-width: 85vw;
  background: var(--color-toolbar-bg-solid);
  border-right: 1px solid var(--color-toolbar-border);
  box-shadow: 8px 0 32px -8px rgba(0, 0, 0, 0.2);
  animation: slideInLeft 0.25s ease;
  overflow: hidden;
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.dark .drawer-panel {
  box-shadow: 8px 0 32px -8px rgba(0, 0, 0, 0.5);
}

/* Views container - holds both views side by side */
.views-container {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.views-container.show-projects {
  transform: translateX(-50%);
}

/* Individual views */
.view {
  width: 50%;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* Header */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-logo {
  height: 28px;
}

.drawer-title {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.drawer-close:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

/* Back button */
.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: var(--color-toolbar-hover);
}

.back-arrow {
  transform: rotate(-90deg);
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
}

/* User section */
.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-toolbar-hover);
  flex-shrink: 0;
}

.user-avatar,
.user-avatar-initials {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-avatar {
  object-fit: cover;
}

.user-avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  color: white;
  font-size: 16px;
  font-weight: 600;
}

.user-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.plan-badge.free {
  color: var(--color-text-secondary);
  background: var(--color-toolbar-bg-solid);
}

.plan-badge.pro {
  color: white;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35);
}

.plan-badge.canceled {
  color: #a8a29e;
  background: linear-gradient(135deg, #78716c, #57534e);
}

/* Cancellation notice */
.cancel-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.08);
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
  flex-shrink: 0;
}

.cancel-icon {
  width: 18px;
  height: 18px;
  color: #f59e0b;
  flex-shrink: 0;
}

.cancel-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cancel-title {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
}

.cancel-date {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* Sign in section */
.signin-section {
  padding: 16px;
  background: var(--color-toolbar-hover);
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.signin-prompt {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.signin-icon {
  width: 20px;
  height: 20px;
  color: var(--color-accent-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.signin-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.google-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-toolbar-border);
  background: white;
  color: #1f1f1f;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
}

.dark .google-signin-btn {
  background: #131314;
  color: #e3e3e3;
  border-color: #5f6368;
}

.google-signin-btn:hover {
  background: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dark .google-signin-btn:hover {
  background: #1f1f1f;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.google-icon {
  flex-shrink: 0;
}

/* Content area */
.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Menu sections */
.menu-section {
  padding: 8px 12px;
}

.section-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--color-text-tertiary);
  padding: 8px 12px 6px;
}

/* Menu items */
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  text-align: left;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
}

.menu-item:hover {
  background: var(--color-toolbar-hover);
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-item :deep(svg) {
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.menu-item span {
  flex: 1;
}

.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger :deep(svg) {
  color: #ef4444;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Nav item with arrow */
.menu-item.nav-item .nav-arrow {
  transform: rotate(90deg);
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
}

/* Toggle item */
.menu-item.toggle-item {
  gap: 12px;
}

.toggle-switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-toolbar-border);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(18px);
}

/* Upgrade item */
.menu-item.upgrade-item {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08));
  color: var(--color-accent-primary);
}

.menu-item.upgrade-item :deep(svg) {
  color: var(--color-accent-primary);
}

.menu-item.upgrade-item:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
}

.upgrade-price {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-toolbar-bg-solid);
  padding: 3px 8px;
  border-radius: 6px;
}

/* Logout item */
.menu-item.logout-item {
  color: #ef4444;
}

.menu-item.logout-item :deep(svg) {
  color: #ef4444;
}

.menu-item.logout-item:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Footer */
.drawer-footer {
  padding: 12px;
  border-top: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
}

.footer-meta {
  padding: 8px 12px 0;
  text-align: center;
}

.version {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* ============================================
   PROJECTS VIEW STYLES
   ============================================ */

.actions-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-toolbar-border);
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex: 1;
  justify-content: center;
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

.action-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.projects-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--color-text-secondary);
  gap: 10px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-toolbar-border);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 10px;
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
  width: 48px;
  height: 36px;
  border-radius: 6px;
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

.thumbnail-placeholder :deep(svg) {
  width: 16px;
  height: 16px;
}

.project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.project-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.project-name-input {
  font-size: 13px;
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
  font-size: 11px;
  color: var(--color-text-secondary);
}

.project-actions {
  display: flex;
  gap: 2px;
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
  width: 26px;
  height: 26px;
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

.project-action-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.current-project-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--color-toolbar-hover);
  border-top: 1px solid var(--color-toolbar-border);
  font-size: 12px;
  flex-shrink: 0;
}

.cloud-icon {
  width: 14px;
  height: 14px;
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
  flex: 1;
}

.save-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
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
