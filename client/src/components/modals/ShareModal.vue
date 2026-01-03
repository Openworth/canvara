<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCollaborationStore } from '../../stores/collaboration'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const collaborationStore = useCollaborationStore()

const copied = ref(false)
const isCreatingRoom = ref(false)

const isInRoom = computed(() => !!collaborationStore.roomId)
const shareableLink = computed(() => collaborationStore.getShareableLink())

async function createRoom() {
  isCreatingRoom.value = true
  try {
    const roomId = await collaborationStore.createRoom()
    router.push(`/${roomId}`)
  } finally {
    isCreatingRoom.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareableLink.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function stopLiveSession() {
  collaborationStore.leaveRoom()
  router.push('/')
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 modal-backdrop"
      @click="emit('close')"
    />

    <!-- Modal -->
    <div class="share-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-content">
          <div class="header-icon" :class="{ 'is-live': isInRoom }">
            <ToolIcon :name="isInRoom ? 'users' : 'share'" class="w-4 h-4" />
          </div>
          <h2 class="modal-title">
            {{ isInRoom ? 'Live Collaboration' : 'Share' }}
          </h2>
        </div>
        
        <!-- Close button -->
        <button
          class="close-button"
          @click="emit('close')"
          aria-label="Close modal"
        >
          <ToolIcon name="close" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Divider -->
      <div class="modal-divider" />

      <!-- Content -->
      <div class="modal-body">
        <!-- Not in room state -->
        <div v-if="!isInRoom" class="start-session">
          <p class="description">
            Start a live collaboration session to work with others in real-time. 
            Share the link to invite collaborators.
          </p>

          <button
            class="btn-primary start-button"
            :disabled="isCreatingRoom"
            @click="createRoom"
          >
            <ToolIcon v-if="!isCreatingRoom" name="zap" class="w-3.5 h-3.5" />
            <span v-if="isCreatingRoom" class="loading-spinner" />
            {{ isCreatingRoom ? 'Creating Session...' : 'Start Live Session' }}
          </button>
        </div>

        <!-- In room state -->
        <div v-else class="active-session">
          <p class="description">
            Share this link with others to collaborate:
          </p>

          <!-- Link input group -->
          <div class="link-group">
            <div class="link-input-wrapper">
              <ToolIcon name="link" class="link-icon" />
              <input
                type="text"
                :value="shareableLink"
                readonly
                class="link-input"
              />
            </div>
            <button
              class="copy-button"
              :class="{ 'copied': copied }"
              @click="copyLink"
            >
              <ToolIcon :name="copied ? 'check' : 'copy'" class="w-3.5 h-3.5" />
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>

          <!-- Connected users -->
          <div class="users-section">
            <h3 class="users-title">
              <span class="live-dot" />
              Connected Users
              <span class="user-count">{{ collaborationStore.collaboratorList.length + 1 }}</span>
            </h3>
            
            <div class="users-list">
              <!-- Current user -->
              <div class="user-item is-you">
                <div
                  class="user-avatar"
                  :style="{ backgroundColor: collaborationStore.userColor }"
                >
                  {{ collaborationStore.username.charAt(0).toUpperCase() }}
                </div>
                <span class="user-name">{{ collaborationStore.username }}</span>
                <span class="you-badge">you</span>
              </div>

              <!-- Other users -->
              <div
                v-for="collab in collaborationStore.collaboratorList"
                :key="collab.userId"
                class="user-item"
              >
                <div
                  class="user-avatar"
                  :style="{ backgroundColor: collab.color }"
                >
                  {{ collab.username.charAt(0).toUpperCase() }}
                </div>
                <span class="user-name">{{ collab.username }}</span>
              </div>
            </div>
          </div>

          <!-- Stop session button -->
          <button
            class="stop-button"
            @click="stopLiveSession"
          >
            <ToolIcon name="close" class="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-toolbar-border);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-lg);
  animation: fadeIn var(--transition-normal) ease-out;
  overflow: hidden;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 12px 14px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-secondary);
  transition: background-color var(--transition-fast);
}

.header-icon.is-live {
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-hover));
  color: white;
  box-shadow: 0 4px 12px var(--color-accent-glow);
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.close-button:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

/* Divider */
.modal-divider {
  height: 1px;
  background: var(--color-toolbar-border);
  margin: 0 14px;
}

/* Body */
.modal-body {
  padding: 14px;
}

.description {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0 0 14px 0;
}

/* Start session state */
.start-session .start-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
}

/* Link group */
.link-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.link-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.link-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
}

.link-input {
  width: 100%;
  padding: 8px 8px 8px 30px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 11px;
  font-family: var(--font-cascadia);
}

.link-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-glow);
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.copy-button:hover {
  background: var(--color-accent-hover);
}

.copy-button.copied {
  background: #10b981;
}

/* Users section */
.users-section {
  margin-bottom: 14px;
}

.users-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.user-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--color-toolbar-hover);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-toolbar-hover);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.user-item:hover {
  background: var(--color-toolbar-active);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.user-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.you-badge {
  padding: 2px 6px;
  background: var(--color-accent-primary);
  color: white;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Stop button */
.stop-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  background: transparent;
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stop-button:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

/* Loading spinner */
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
