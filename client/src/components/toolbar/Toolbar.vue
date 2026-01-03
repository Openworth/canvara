<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import type { Tool } from '../../types'
import ToolButton from './ToolButton.vue'
import ToolIcon from './ToolIcon.vue'

const canvasStore = useCanvasStore()

// Mobile detection
const isMobile = ref(false)
const showMoreTools = ref(false)

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

interface ToolConfig {
  id: Tool
  icon: string
  label: string
  shortcut: string
}

// Tool groups for visual separation
const selectionTools: ToolConfig[] = [
  { id: 'selection', icon: 'cursor', label: 'Selection', shortcut: '1 or V' },
]

const shapeTools: ToolConfig[] = [
  { id: 'rectangle', icon: 'rectangle', label: 'Rectangle', shortcut: '2 or R' },
  { id: 'ellipse', icon: 'ellipse', label: 'Ellipse', shortcut: '3 or O' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', shortcut: '4 or D' },
]

const lineTools: ToolConfig[] = [
  { id: 'arrow', icon: 'arrow', label: 'Arrow', shortcut: '5 or A' },
  { id: 'line', icon: 'line', label: 'Line', shortcut: '6 or L' },
]

const drawingTools: ToolConfig[] = [
  { id: 'freedraw', icon: 'pencil', label: 'Draw', shortcut: '7 or P' },
  { id: 'text', icon: 'text', label: 'Text', shortcut: '8 or T' },
]

const utilityTools: ToolConfig[] = [
  { id: 'eraser', icon: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'hand', icon: 'hand', label: 'Hand (pan)', shortcut: 'H or Space' },
]

// Primary tools shown on mobile (most used)
const primaryTools: ToolConfig[] = [
  { id: 'hand', icon: 'hand', label: 'Pan', shortcut: 'H or Space' },
  ...selectionTools,
  { id: 'rectangle', icon: 'rectangle', label: 'Rectangle', shortcut: '2 or R' },
  { id: 'ellipse', icon: 'ellipse', label: 'Ellipse', shortcut: '3 or O' },
  { id: 'arrow', icon: 'arrow', label: 'Arrow', shortcut: '5 or A' },
]

// Secondary tools in "more" dropdown on mobile
const secondaryTools: ToolConfig[] = [
  { id: 'freedraw', icon: 'pencil', label: 'Draw', shortcut: '7 or P' },
  { id: 'text', icon: 'text', label: 'Text', shortcut: '8 or T' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', shortcut: '4 or D' },
  { id: 'line', icon: 'line', label: 'Line', shortcut: '6 or L' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', shortcut: 'E' },
]

// Grid toggle state
const showGrid = computed(() => canvasStore.appState.showGrid)

function toggleGrid() {
  canvasStore.toggleGrid()
}

const activeTool = computed(() => canvasStore.activeTool)

// Check if active tool is in secondary tools (to highlight more button)
const isSecondaryToolActive = computed(() => 
  secondaryTools.some(t => t.id === activeTool.value)
)

function selectTool(tool: Tool) {
  canvasStore.setActiveTool(tool)
  showMoreTools.value = false
}

function toggleMoreTools() {
  showMoreTools.value = !showMoreTools.value
}

// Close more tools when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.more-tools-container')) {
    showMoreTools.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <!-- Desktop: Left vertical toolbar -->
  <div
    v-if="!isMobile"
    class="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col p-1.5 gap-0.5 panel-glass animate-fade-in"
  >
    <!-- Undo/Redo Group -->
    <div class="flex flex-col gap-0.5">
      <button
        class="toolbar-button"
        :class="{ 'opacity-40 cursor-not-allowed': !canvasStore.canUndo }"
        :disabled="!canvasStore.canUndo"
        title="Undo (Ctrl+Z)"
        @click="canvasStore.undo()"
      >
        <ToolIcon name="undo" class="w-4 h-4" />
      </button>
      <button
        class="toolbar-button"
        :class="{ 'opacity-40 cursor-not-allowed': !canvasStore.canRedo }"
        :disabled="!canvasStore.canRedo"
        title="Redo (Ctrl+Shift+Z)"
        @click="canvasStore.redo()"
      >
        <ToolIcon name="redo" class="w-4 h-4" />
      </button>
    </div>

    <!-- Divider -->
    <div class="toolbar-divider" />

    <!-- Selection Tool -->
    <div class="flex flex-col gap-0.5">
      <ToolButton
        v-for="tool in selectionTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :shortcut="tool.shortcut"
        :active="activeTool === tool.id"
        @click="selectTool(tool.id)"
      />
    </div>

    <!-- Divider -->
    <div class="toolbar-divider" />

    <!-- Shape Tools -->
    <div class="flex flex-col gap-0.5">
      <ToolButton
        v-for="tool in shapeTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :shortcut="tool.shortcut"
        :active="activeTool === tool.id"
        @click="selectTool(tool.id)"
      />
    </div>

    <!-- Divider -->
    <div class="toolbar-divider" />

    <!-- Line Tools -->
    <div class="flex flex-col gap-0.5">
      <ToolButton
        v-for="tool in lineTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :shortcut="tool.shortcut"
        :active="activeTool === tool.id"
        @click="selectTool(tool.id)"
      />
    </div>

    <!-- Divider -->
    <div class="toolbar-divider" />

    <!-- Drawing Tools -->
    <div class="flex flex-col gap-0.5">
      <ToolButton
        v-for="tool in drawingTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :shortcut="tool.shortcut"
        :active="activeTool === tool.id"
        @click="selectTool(tool.id)"
      />
    </div>

    <!-- Divider -->
    <div class="toolbar-divider" />

    <!-- Utility Tools -->
    <div class="flex flex-col gap-0.5">
      <ToolButton
        v-for="tool in utilityTools"
        :key="tool.id"
        :icon="tool.icon"
        :label="tool.label"
        :shortcut="tool.shortcut"
        :active="activeTool === tool.id"
        @click="selectTool(tool.id)"
      />
    </div>
  </div>

  <!-- Mobile: Floating bottom toolbar -->
  <div v-else class="mobile-toolbar-wrapper">
    <div class="mobile-toolbar">
      <!-- Undo/Redo Section -->
      <div class="toolbar-section">
        <button
          class="mobile-tool-btn"
          :class="{ 'disabled': !canvasStore.canUndo }"
          :disabled="!canvasStore.canUndo"
          @click="canvasStore.undo()"
        >
          <ToolIcon name="undo" class="w-4 h-4" />
        </button>
        <button
          class="mobile-tool-btn"
          :class="{ 'disabled': !canvasStore.canRedo }"
          :disabled="!canvasStore.canRedo"
          @click="canvasStore.redo()"
        >
          <ToolIcon name="redo" class="w-4 h-4" />
        </button>
      </div>

      <!-- Separator -->
      <div class="toolbar-separator" />

      <!-- Primary Tools Section -->
      <div class="toolbar-section tools-section">
        <button
          v-for="tool in primaryTools"
          :key="tool.id"
          class="mobile-tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Separator -->
      <div class="toolbar-separator" />

      <!-- More Tools -->
      <div class="more-tools-container">
        <button
          class="mobile-tool-btn"
          :class="{ 'active': isSecondaryToolActive, 'menu-open': showMoreTools }"
          @click.stop="toggleMoreTools"
        >
          <ToolIcon name="more" class="w-4 h-4" />
        </button>

        <!-- Dropdown Menu -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div v-if="showMoreTools" class="more-tools-dropdown">
            <button
              v-for="tool in secondaryTools"
              :key="tool.id"
              class="dropdown-item"
              :class="{ 'active': activeTool === tool.id }"
              @click="selectTool(tool.id)"
            >
              <ToolIcon :name="tool.icon" class="w-5 h-5" />
              <span class="tool-label">{{ tool.label }}</span>
            </button>
            
            <!-- Divider -->
            <div class="dropdown-divider" />
            
            <!-- Grid toggle -->
            <button
              class="dropdown-item"
              :class="{ 'active': showGrid }"
              @click="toggleGrid"
            >
              <ToolIcon name="grid" class="w-5 h-5" />
              <span class="tool-label">{{ showGrid ? 'Hide Grid' : 'Show Grid' }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-toolbar-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.mobile-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 18px;
  box-shadow: 
    0 4px 24px -4px rgba(0, 0, 0, 0.12),
    0 8px 16px -8px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  pointer-events: auto;
  max-width: calc(100vw - 32px);
}

.dark .mobile-toolbar {
  box-shadow: 
    0 4px 24px -4px rgba(0, 0, 0, 0.4),
    0 8px 16px -8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 1px;
}

.tools-section {
  background: var(--color-toolbar-hover);
  border-radius: 13px;
  padding: 3px;
}

.toolbar-separator {
  width: 1px;
  height: 22px;
  background: var(--color-toolbar-border);
  margin: 0 3px;
  opacity: 0.5;
}

.mobile-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  flex-shrink: 0;
}

.mobile-tool-btn:active {
  transform: scale(0.92);
}

.mobile-tool-btn.disabled {
  opacity: 0.3;
  pointer-events: none;
}

.mobile-tool-btn.active {
  background: var(--color-accent-primary);
  color: white;
  box-shadow: 
    0 2px 8px -2px var(--color-accent-primary),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.mobile-tool-btn.menu-open {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.more-tools-container {
  position: relative;
}

.more-tools-dropdown {
  position: absolute;
  bottom: calc(100% + 12px);
  right: -8px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 16px;
  padding: 8px;
  box-shadow: 
    0 8px 32px -8px rgba(0, 0, 0, 0.2),
    0 4px 16px -4px rgba(0, 0, 0, 0.1);
  min-width: 160px;
  transform-origin: bottom right;
}

.dark .more-tools-dropdown {
  box-shadow: 
    0 8px 32px -8px rgba(0, 0, 0, 0.5),
    0 4px 16px -4px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.dropdown-item:active {
  transform: scale(0.98);
  background: var(--color-toolbar-hover);
}

.dropdown-item.active {
  background: var(--color-accent-primary);
  color: white;
}

.dropdown-item .tool-label {
  font-size: 14px;
  font-weight: 500;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-toolbar-border);
  margin: 6px 0;
}
</style>
