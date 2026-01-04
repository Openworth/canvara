<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = defineProps<{
  isMobile?: boolean
}>()

const emit = defineEmits<{
  close: []
  export: []
  share: []
  clearCanvas: []
}>()

const canvasStore = useCanvasStore()
const appStore = useAppStore()

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
  emit('close')
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
  <div class="menu-dropdown-wrapper">
    <!-- Click outside to close -->
    <div
      class="fixed inset-0 z-20"
      @click="emit('close')"
    />

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        class="menu-content panel-glass-strong"
        :class="isMobile ? 'w-48' : 'w-44'"
      >
        <button
          v-for="item in visibleItems"
          :key="item.label"
          class="menu-item"
          :class="{ 'danger': item.danger }"
          @click="item.action"
        >
          <ToolIcon :name="item.icon" class="w-4 h-4" />
          <span class="flex-1 text-sm font-medium">{{ item.label }}</span>
          <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
        </button>

        <!-- Theme toggle (mobile only) -->
        <template v-if="isMobile">
          <div class="menu-divider" />
          <button
            class="menu-item"
            @click="handleToggleTheme"
          >
            <ToolIcon :name="appStore.isDarkMode ? 'sun' : 'moon'" class="w-4 h-4" />
            <span class="flex-1 text-sm font-medium">{{ appStore.isDarkMode ? 'Light mode' : 'Dark mode' }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-dropdown-wrapper {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 30;
}

.menu-content {
  position: relative;
  margin-top: 6px;
  padding: 6px 0;
  z-index: 30;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  text-align: left;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: var(--color-toolbar-hover);
}

.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.shortcut {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.menu-divider {
  height: 1px;
  background: var(--color-toolbar-border);
  margin: 6px 12px;
}
</style>
