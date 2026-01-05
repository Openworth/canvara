<script setup lang="ts">
import { computed } from 'vue'
import { useProjectsStore } from '../../stores/projects'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'

const projectsStore = useProjectsStore()
const authStore = useAuthStore()

const showIndicator = computed(() => {
  return authStore.isPaidUser && projectsStore.isCloudProject
})

const statusText = computed(() => {
  if (projectsStore.isSaving) return 'Saving...'
  if (projectsStore.lastSavedAt) return 'Saved'
  return 'Cloud'
})

const statusClass = computed(() => {
  if (projectsStore.isSaving) return 'saving'
  return 'saved'
})

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'just now'
  if (diffMins === 1) return '1 min ago'
  if (diffMins < 60) return `${diffMins} mins ago`
  return date.toLocaleTimeString()
}
</script>

<template>
  <div 
    v-if="showIndicator" 
    :class="['cloud-indicator', statusClass]"
    v-tooltip.bottom="projectsStore.lastSavedAt ? `Last saved ${formatTime(projectsStore.lastSavedAt)}` : 'Cloud sync enabled'"
  >
    <ToolIcon :name="projectsStore.isSaving ? 'cloud' : 'cloud'" class="cloud-icon" />
    <span class="status-text">{{ statusText }}</span>
    <div v-if="projectsStore.isSaving" class="saving-dots">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>
</template>

<style scoped>
.cloud-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cloud-indicator.saving {
  border-color: var(--color-accent-primary);
  background: rgba(59, 130, 246, 0.1);
}

.cloud-indicator.saved {
  color: #22c55e;
}

.cloud-icon {
  width: 14px;
  height: 14px;
}

.saving .cloud-icon {
  color: var(--color-accent-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

.saved .cloud-icon {
  color: #22c55e;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  color: var(--color-text-secondary);
}

.saving .status-text {
  color: var(--color-accent-primary);
}

.saved .status-text {
  color: #22c55e;
}

.saving-dots {
  display: flex;
  gap: 2px;
}

.dot {
  width: 4px;
  height: 4px;
  background: var(--color-accent-primary);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}
</style>

