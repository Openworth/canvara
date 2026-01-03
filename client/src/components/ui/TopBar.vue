<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCollaborationStore } from '../../stores/collaboration'
import { useAppStore } from '../../stores/app'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ShareModal from '../modals/ShareModal.vue'
import ExportModal from '../modals/ExportModal.vue'
import KeyboardShortcutsModal from '../modals/KeyboardShortcutsModal.vue'
import MenuDropdown from './MenuDropdown.vue'

const collaborationStore = useCollaborationStore()
const appStore = useAppStore()

const showMenu = ref(false)
const showShareModal = ref(false)
const showExportModal = ref(false)
const showKeyboardShortcutsModal = ref(false)

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
    class="absolute top-3 left-0 right-0 z-20 flex items-center justify-between px-3"
  >
    <!-- Left side: Menu + Logo -->
    <div class="flex items-center gap-1.5">
      <!-- Menu button -->
      <div class="relative">
        <button
          class="toolbar-button panel-glass"
          @click="showMenu = !showMenu"
        >
          <ToolIcon name="menu" class="w-4 h-4" />
        </button>
        
        <MenuDropdown
          v-if="showMenu"
          :is-mobile="false"
          @close="showMenu = false"
          @export="showExportModal = true"
          @share="showShareModal = true"
        />
      </div>

      <!-- Logo -->
      <div class="panel-glass px-2 py-1.5 flex items-center gap-2">
        <img :src="appStore.isDarkMode ? '/logo-icon.svg' : '/logo-icon-light.svg'" alt="Canvara" class="w-6 h-6" />
        <span class="text-sm font-semibold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          Canvara
        </span>
      </div>
    </div>

    <!-- Right side: Collaboration + Share + Theme -->
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

      <!-- Share button -->
      <button
        class="btn-primary flex items-center gap-1.5"
        @click="showShareModal = true"
      >
        <ToolIcon name="share" class="w-3.5 h-3.5" />
        <span class="text-xs font-medium">Share</span>
      </button>

      <!-- Keyboard shortcuts button -->
      <button
        class="toolbar-button panel-glass"
        v-tooltip.bottom="'Keyboard shortcuts (?)'"
        @click="showKeyboardShortcutsModal = true"
      >
        <ToolIcon name="keyboard" class="w-4 h-4" />
      </button>

      <!-- Theme toggle -->
      <button
        class="toolbar-button panel-glass"
        v-tooltip.bottom="'Toggle dark mode'"
        @click="appStore.toggleDarkMode()"
      >
        <ToolIcon
          :name="appStore.isDarkMode ? 'sun' : 'moon'"
          class="w-4 h-4"
        />
      </button>
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
          @export="showExportModal = true"
          @share="showShareModal = true"
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
    v-if="showExportModal"
    @close="showExportModal = false"
  />

  <KeyboardShortcutsModal
    v-if="showKeyboardShortcutsModal"
    @close="showKeyboardShortcutsModal = false"
  />
</template>

<style scoped>
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
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.2);
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

</style>
