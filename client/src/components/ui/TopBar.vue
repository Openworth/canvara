<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCollaborationStore } from '../../stores/collaboration'
import { useAppStore } from '../../stores/app'
import { useCanvasStore } from '../../stores/canvas'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ShareModal from '../modals/ShareModal.vue'
import ExportModal from '../modals/ExportModal.vue'
import KeyboardShortcutsModal from '../modals/KeyboardShortcutsModal.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import MenuDropdown from './MenuDropdown.vue'
import LoginButton from './LoginButton.vue'
import UserMenu from './UserMenu.vue'
import ProjectsDrawer from './ProjectsDrawer.vue'
import UpgradeModal from '../modals/UpgradeModal.vue'
import CloudSyncIndicator from './CloudSyncIndicator.vue'
import UpgradeBadge from './UpgradeBadge.vue'

const collaborationStore = useCollaborationStore()
const appStore = useAppStore()
const canvasStore = useCanvasStore()
const authStore = useAuthStore()

const showMenu = ref(false)
const showShareModal = ref(false)
const showKeyboardShortcutsModal = ref(false)
const showClearCanvasModal = ref(false)
const showProjectsDrawer = ref(false)
const showUpgradeModal = ref(false)

function handleClearCanvasConfirm() {
  canvasStore.clearCanvas()
  showClearCanvasModal.value = false
}

// Mobile detection
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const isInRoom = computed(() => !!collaborationStore.roomId)
const collaboratorCount = computed(() => collaborationStore.collaboratorList.length)

// Listen for keyboard shortcut event
function handleToggleShortcuts() {
  showKeyboardShortcutsModal.value = !showKeyboardShortcutsModal.value
}

onMounted(() => {
  window.addEventListener('toggle-keyboard-shortcuts', handleToggleShortcuts)
})

onUnmounted(() => {
  window.removeEventListener('toggle-keyboard-shortcuts', handleToggleShortcuts)
})
</script>

<template>
  <!-- Desktop TopBar -->
  <div 
    v-if="!isMobile"
    class="topbar-container absolute top-3 left-0 right-0 z-20 flex items-center justify-between px-3"
  >
    <!-- Left side: Menu + Logo -->
    <div class="flex items-center gap-2">
      <!-- Menu button -->
      <div class="relative">
        <button
          class="topbar-menu-btn"
          @click="showMenu = !showMenu"
        >
          <ToolIcon name="menu" class="w-4 h-4" />
        </button>
        
        <MenuDropdown
          v-if="showMenu"
          :is-mobile="false"
          @close="showMenu = false"
          @export="appStore.openExportModal()"
          @share="showShareModal = true"
          @clear-canvas="showClearCanvasModal = true"
        />
      </div>

      <!-- Logo -->
      <div class="topbar-logo">
        <img :src="appStore.isDarkMode ? '/logo-icon.svg' : '/logo-icon-light.svg'" alt="Canvara" class="w-7 h-7" />
        <span class="text-base font-semibold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          Canvara
        </span>
      </div>
    </div>

    <!-- Right side: Share button pushed to far right -->
    <div class="flex items-center gap-3">
      <!-- Left group: Collaboration status + icon buttons -->
      <div class="flex items-center gap-1.5">
        <!-- Collaborators -->
        <div
          v-if="isInRoom && collaboratorCount > 0"
          class="panel-glass flex items-center gap-1.5 px-2.5 py-1.5"
        >
          <div class="flex -space-x-1.5">
            <div
              v-for="collab in collaborationStore.collaboratorList.slice(0, 3)"
              :key="collab.userId"
              class="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-[10px] font-medium"
              :style="{ backgroundColor: collab.color }"
              v-tooltip.bottom="collab.username"
            >
              {{ collab.username.charAt(0).toUpperCase() }}
            </div>
          </div>
          <span v-if="collaboratorCount > 3" class="text-[10px]" style="color: var(--color-text-secondary);">
            +{{ collaboratorCount - 3 }}
          </span>
        </div>

        <!-- Connection status -->
        <div
          v-if="isInRoom"
          class="panel-glass flex items-center gap-1.5 px-2.5 py-1.5"
        >
          <div
            class="w-1.5 h-1.5 rounded-full"
            :class="{
              'bg-green-500': appStore.connectionStatus === 'connected',
              'bg-yellow-500 animate-pulse': appStore.connectionStatus === 'connecting',
              'bg-red-500': appStore.connectionStatus === 'disconnected',
            }"
          />
          <span class="text-[11px] font-medium capitalize" style="color: var(--color-text-primary);">
            {{ appStore.connectionStatus }}
          </span>
        </div>

        <!-- Cloud sync indicator -->
        <CloudSyncIndicator />

        <!-- Keyboard shortcuts button -->
        <button
          class="topbar-ghost-btn"
          v-tooltip.bottom="'Keyboard shortcuts (?)'"
          @click="showKeyboardShortcutsModal = true"
        >
          <ToolIcon name="keyboard" class="w-4 h-4" />
        </button>

        <!-- Theme toggle -->
        <button
          class="topbar-ghost-btn"
          v-tooltip.bottom="'Toggle dark mode'"
          @click="appStore.toggleDarkMode()"
        >
          <ToolIcon
            :name="appStore.isDarkMode ? 'sun' : 'moon'"
            class="w-4 h-4"
          />
        </button>
      </div>

      <!-- Share button - separated to the right -->
      <button
        class="share-btn flex items-center gap-1.5"
        @click="showShareModal = true"
      >
        <ToolIcon name="share" class="w-3.5 h-3.5" />
        <span class="text-xs font-semibold">Share</span>
      </button>

      <!-- Auth section -->
      <div class="auth-section">
        <template v-if="!authStore.isAuthenticated">
          <LoginButton />
        </template>
        <template v-else>
          <UpgradeBadge @click="showUpgradeModal = true" />
          <UserMenu 
            @openProjects="showProjectsDrawer = true"
            @openUpgrade="showUpgradeModal = true"
          />
        </template>
      </div>
    </div>
  </div>

  <!-- Mobile TopBar - Clean minimal design -->
  <div 
    v-else
    class="mobile-topbar-wrapper"
  >
    <!-- Left: Menu + Logo -->
    <div class="mobile-topbar-group">
      <div class="relative">
        <button
          class="mobile-icon-btn"
          @click="showMenu = !showMenu"
        >
          <ToolIcon name="menu" class="w-5 h-5" />
        </button>
        
        <MenuDropdown
          v-if="showMenu"
          :is-mobile="true"
          @close="showMenu = false"
          @export="appStore.openExportModal()"
          @share="showShareModal = true"
          @clear-canvas="showClearCanvasModal = true"
        />
      </div>

      <!-- Logo/Brand - pill style -->
      <div class="brand-pill">
        <img :src="appStore.isDarkMode ? '/logo-icon.svg' : '/logo-icon-light.svg'" alt="Canvara" class="brand-icon" />
        <span class="brand-text">Canvara</span>
      </div>
    </div>

    <!-- Right: Collaboration status only -->
    <div class="mobile-topbar-group">
      <!-- Collaborators (compact) -->
      <div
        v-if="isInRoom && collaboratorCount > 0"
        class="collab-indicator"
      >
        <div class="collab-avatars">
          <div
            v-for="collab in collaborationStore.collaboratorList.slice(0, 2)"
            :key="collab.userId"
            class="collab-avatar"
            :style="{ backgroundColor: collab.color }"
          >
            {{ collab.username.charAt(0).toUpperCase() }}
          </div>
        </div>
        <span v-if="collaboratorCount > 2" class="collab-count">
          +{{ collaboratorCount - 2 }}
        </span>
      </div>

      <!-- Connection status dot (inline) -->
      <div
        v-if="isInRoom"
        class="connection-dot"
        :class="{
          'connected': appStore.connectionStatus === 'connected',
          'connecting': appStore.connectionStatus === 'connecting',
          'disconnected': appStore.connectionStatus === 'disconnected',
        }"
        v-tooltip.bottom="appStore.connectionStatus"
      />
    </div>
  </div>

  <!-- Modals -->
  <ShareModal
    v-if="showShareModal"
    @close="showShareModal = false"
  />

  <ExportModal
    v-if="appStore.showExportModal"
    @close="appStore.closeExportModal()"
  />

  <KeyboardShortcutsModal
    v-if="showKeyboardShortcutsModal"
    @close="showKeyboardShortcutsModal = false"
  />

  <ConfirmModal
    v-if="showClearCanvasModal"
    title="Clear canvas"
    message="Are you sure you want to clear the canvas? This action cannot be undone and all your drawings will be permanently deleted."
    confirm-text="Clear canvas"
    cancel-text="Cancel"
    :danger="true"
    @confirm="handleClearCanvasConfirm"
    @cancel="showClearCanvasModal = false"
  />

  <ProjectsDrawer
    v-if="showProjectsDrawer"
    @close="showProjectsDrawer = false"
  />

  <UpgradeModal
    v-if="showUpgradeModal"
    @close="showUpgradeModal = false"
  />
</template>

<style scoped>
/* Ghost icon buttons - no background or shadow */
.topbar-ghost-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.topbar-ghost-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
}

.topbar-ghost-btn:active {
  transform: scale(0.92);
}

/* Menu button with background */
.topbar-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  cursor: pointer;
  transition: all 0.15s ease;
}

.topbar-menu-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
}

.topbar-menu-btn:active {
  transform: scale(0.95);
}

/* Logo - clean, no background */
.topbar-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.mobile-topbar-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: max(12px, env(safe-area-inset-top, 12px));
  pointer-events: none;
}

.mobile-topbar-group {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

/* Plain icon button - no box, like desktop */
.mobile-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s ease;
}

.mobile-icon-btn:active {
  transform: scale(0.9);
  background: var(--color-toolbar-hover);
}

.brand-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
}

.dark .brand-pill {
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
}

.brand-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.brand-text {
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.collab-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 10px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
}

.collab-avatars {
  display: flex;
  margin-left: -2px;
}

.collab-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--color-toolbar-bg-solid);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: white;
  margin-left: -6px;
}

.collab-avatar:first-child {
  margin-left: 0;
}

.collab-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: 2px;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.connection-dot.connected {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.connection-dot.connecting {
  background: #eab308;
  animation: pulse 1.5s ease-in-out infinite;
}

.connection-dot.disconnected {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Enhanced Share button */
.share-btn {
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 
    0 2px 10px -2px rgba(59, 130, 246, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  position: relative;
  overflow: hidden;
}

.share-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.share-btn:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 4px 16px -2px rgba(59, 130, 246, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.share-btn:hover::before {
  opacity: 1;
}

.share-btn:active {
  transform: translateY(0);
}

/* Softer shadows in dark mode */
.dark .share-btn {
  box-shadow: 
    0 2px 10px -2px rgba(59, 130, 246, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.dark .share-btn:hover {
  box-shadow: 
    0 4px 16px -2px rgba(59, 130, 246, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Auth section */
.auth-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--color-toolbar-border);
}

/* TopBar entrance animation */
.topbar-container {
  animation: topbarSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes topbarSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
