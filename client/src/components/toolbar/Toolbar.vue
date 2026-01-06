<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'
import { useImageStore } from '../../stores/images'
import type { Tool } from '../../types'
import ToolIcon from './ToolIcon.vue'

const canvasStore = useCanvasStore()
const appStore = useAppStore()
const imageStore = useImageStore()

// File input for image upload
const imageInputRef = ref<HTMLInputElement | null>(null)

// Mobile detection
const isMobile = ref(false)
const showMoreTools = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

// Handle keyboard shortcut for image tool
function handleImageShortcut() {
  imageInputRef.value?.click()
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('open-image-picker', handleImageShortcut)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('open-image-picker', handleImageShortcut)
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
  { id: 'image', icon: 'image', label: 'Image', shortcut: '9 or I' },
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
  { id: 'image', icon: 'image', label: 'Image', shortcut: '9 or I' },
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
  if (tool === 'image') {
    // For image tool, open file picker immediately
    imageInputRef.value?.click()
    showMoreTools.value = false
    return
  }
  canvasStore.setActiveTool(tool)
  showMoreTools.value = false
}

// Handle image file selection
async function handleImageSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  // Get image dimensions before upload
  const dimensions = await imageStore.getImageDimensions(file)
  
  // Upload image to server
  const result = await imageStore.uploadImage(file)
  if (!result) {
    console.error('Failed to upload image')
    input.value = ''
    return
  }
  
  // Create image at center of viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const zoom = canvasStore.appState.zoom.value
  const scrollX = canvasStore.appState.scrollX
  const scrollY = canvasStore.appState.scrollY
  
  // Calculate center of canvas in canvas coordinates
  const centerX = (viewportWidth / 2 - scrollX) / zoom - dimensions.width / 2
  const centerY = (viewportHeight / 2 - scrollY) / zoom - dimensions.height / 2
  
  // Create image element
  const element = canvasStore.createElement('image', centerX, centerY)
  element.width = dimensions.width
  element.height = dimensions.height
  element.fileId = result.fileId
  element.status = 'saved'
  
  canvasStore.addElement(element)
  canvasStore.selectElement(element.id)
  
  // Switch to selection tool
  canvasStore.setActiveTool(isMobile.value ? 'hand' : 'selection')
  
  // Reset input so the same file can be selected again
  input.value = ''
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
  <!-- Desktop: Top horizontal toolbar -->
  <div
    v-if="!isMobile"
    v-show="!appStore.showExportModal"
    class="toolbar-container"
  >
    <!-- Inner toolbar content -->
    <div class="toolbar-inner">
      <!-- Undo/Redo Group -->
      <div class="tool-group" style="--group-index: 0;">
        <button
          class="tool-btn"
          :class="{ 'disabled': !canvasStore.canUndo }"
          :disabled="!canvasStore.canUndo"
          v-tooltip.bottom="'Undo (Ctrl+Z)'"
          @click="canvasStore.undo()"
        >
          <ToolIcon name="undo" class="w-4 h-4" />
        </button>
        <button
          class="tool-btn"
          :class="{ 'disabled': !canvasStore.canRedo }"
          :disabled="!canvasStore.canRedo"
          v-tooltip.bottom="'Redo (Ctrl+Shift+Z)'"
          @click="canvasStore.redo()"
        >
          <ToolIcon name="redo" class="w-4 h-4" />
        </button>
      </div>

      <!-- Elegant divider -->
      <div class="tool-divider" />

      <!-- Selection Tool -->
      <div class="tool-group" style="--group-index: 1;">
        <button
          v-for="tool in selectionTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          v-tooltip.bottom="`${tool.label} (${tool.shortcut})`"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Elegant divider -->
      <div class="tool-divider" />

      <!-- Shape Tools -->
      <div class="tool-group" style="--group-index: 2;">
        <button
          v-for="tool in shapeTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          v-tooltip.bottom="`${tool.label} (${tool.shortcut})`"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Elegant divider -->
      <div class="tool-divider" />

      <!-- Line Tools -->
      <div class="tool-group" style="--group-index: 3;">
        <button
          v-for="tool in lineTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          v-tooltip.bottom="`${tool.label} (${tool.shortcut})`"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Elegant divider -->
      <div class="tool-divider" />

      <!-- Drawing Tools -->
      <div class="tool-group" style="--group-index: 4;">
        <button
          v-for="tool in drawingTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          v-tooltip.bottom="`${tool.label} (${tool.shortcut})`"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>

      <!-- Elegant divider -->
      <div class="tool-divider" />

      <!-- Utility Tools -->
      <div class="tool-group" style="--group-index: 5;">
        <button
          v-for="tool in utilityTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ 'active': activeTool === tool.id }"
          v-tooltip.bottom="`${tool.label} (${tool.shortcut})`"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile: Floating bottom toolbar -->
  <div v-else v-show="!appStore.showExportModal && !appStore.showMobilePropertiesPanel" class="mobile-toolbar-wrapper">
    <div class="mobile-toolbar">
      <!-- Undo/Redo Section -->
      <div class="mobile-section">
        <button
          class="mobile-btn mobile-btn-subtle"
          :class="{ 'disabled': !canvasStore.canUndo }"
          :disabled="!canvasStore.canUndo"
          @click="canvasStore.undo()"
        >
          <ToolIcon name="undo" class="w-4 h-4" />
        </button>
        <button
          class="mobile-btn mobile-btn-subtle"
          :class="{ 'disabled': !canvasStore.canRedo }"
          :disabled="!canvasStore.canRedo"
          @click="canvasStore.redo()"
        >
          <ToolIcon name="redo" class="w-4 h-4" />
        </button>
      </div>

      <!-- Separator -->
      <div class="mobile-separator" />

      <!-- Primary Tools Section -->
      <div class="mobile-section mobile-tools-section">
        <button
          v-for="tool in primaryTools"
          :key="tool.id"
          class="mobile-btn"
          :class="{ 'active': activeTool === tool.id }"
          @click="selectTool(tool.id)"
        >
          <ToolIcon :name="tool.icon" class="w-4 h-4" />
          <span class="mobile-btn-ripple" />
        </button>
      </div>

      <!-- Separator -->
      <div class="mobile-separator" />

      <!-- More Tools -->
      <div class="more-tools-container">
        <button
          class="mobile-btn"
          :class="{ 'active': isSecondaryToolActive, 'menu-open': showMoreTools }"
          @click.stop="toggleMoreTools"
        >
          <ToolIcon name="more" class="w-4 h-4" />
        </button>

        <!-- Dropdown Menu -->
        <Transition
          enter-active-class="dropdown-enter-active"
          enter-from-class="dropdown-enter-from"
          enter-to-class="dropdown-enter-to"
          leave-active-class="dropdown-leave-active"
          leave-from-class="dropdown-leave-from"
          leave-to-class="dropdown-leave-to"
        >
          <div v-if="showMoreTools" class="more-dropdown">
            <!-- Dropdown accent -->
            <div class="dropdown-accent" />
            
            <button
              v-for="tool in secondaryTools"
              :key="tool.id"
              class="dropdown-item"
              :class="{ 'active': activeTool === tool.id }"
              @click="selectTool(tool.id)"
            >
              <span class="dropdown-item-icon">
                <ToolIcon :name="tool.icon" class="w-5 h-5" />
              </span>
              <span class="dropdown-item-label">{{ tool.label }}</span>
              <span v-if="activeTool === tool.id" class="dropdown-item-check">
                <ToolIcon name="check" class="w-4 h-4" />
              </span>
            </button>
            
            <!-- Divider -->
            <div class="dropdown-divider" />
            
            <!-- Grid toggle -->
            <button
              class="dropdown-item"
              :class="{ 'active': showGrid }"
              @click="toggleGrid"
            >
              <span class="dropdown-item-icon">
                <ToolIcon name="grid" class="w-5 h-5" />
              </span>
              <span class="dropdown-item-label">{{ showGrid ? 'Hide Grid' : 'Show Grid' }}</span>
              <span v-if="showGrid" class="dropdown-item-check">
                <ToolIcon name="check" class="w-4 h-4" />
              </span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <!-- Hidden file input for image upload -->
  <input
    ref="imageInputRef"
    type="file"
    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
    class="hidden"
    @change="handleImageSelect"
  />
</template>

<style scoped>
/* ============================================
   DESKTOP TOOLBAR
   ============================================ */

.hidden {
  display: none;
}

.toolbar-container {
  position: absolute;
  left: 55px;
  top: 14px;
  z-index: 25;
  display: flex;
  animation: toolbarSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes toolbarSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toolbar-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 34px;
  padding: 0 4px;
  gap: 2px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-sm);
}

.dark .toolbar-inner {
  /* Same styling for dark mode */
}

.tool-group {
  display: flex;
  flex-direction: row;
  gap: 1px;
  animation: toolGroupFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--group-index, 0) * 0.03s);
  opacity: 0;
}

@keyframes toolGroupFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.tool-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-toolbar-hover);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tool-btn:hover {
  color: var(--color-text-primary);
}

.tool-btn:hover::before {
  opacity: 1;
}

.tool-btn:active {
  transform: scale(0.92);
}

.tool-btn.active {
  color: white;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  box-shadow: 
    0 0 0 2px var(--color-accent-glow),
    0 2px 6px -1px rgba(99, 102, 241, 0.35);
}

.tool-btn.active::before {
  display: none;
}

.tool-btn.active:hover {
  box-shadow: 
    0 0 0 3px var(--color-accent-glow),
    0 3px 8px -1px rgba(99, 102, 241, 0.45);
}

.tool-btn.disabled {
  opacity: 0.3;
  pointer-events: none;
}

.tool-divider {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: var(--color-toolbar-border);
}

/* ============================================
   MOBILE TOOLBAR
   ============================================ */

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
  gap: 3px;
  padding: 5px 6px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 20px;
  box-shadow: 
    0 8px 40px -8px rgba(0, 0, 0, 0.15),
    0 4px 20px -4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  pointer-events: auto;
  max-width: calc(100vw - 32px);
  animation: mobileToolbarSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes mobileToolbarSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .mobile-toolbar {
  box-shadow: 
    0 8px 40px -12px rgba(0, 0, 0, 0.25),
    0 4px 20px -6px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.mobile-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.mobile-tools-section {
  background: var(--color-toolbar-hover);
  border-radius: 14px;
  padding: 3px;
}

.mobile-separator {
  width: 1px;
  height: 28px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--color-toolbar-border) 30%,
    var(--color-toolbar-border) 70%,
    transparent 100%
  );
  margin: 0 4px;
}

.mobile-btn {
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
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  -webkit-tap-highlight-color: transparent;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.mobile-btn-subtle {
  width: 34px;
  height: 34px;
}

.mobile-btn-ripple {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--color-accent-primary) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
}

.mobile-btn:active .mobile-btn-ripple {
  animation: ripple 0.4s ease-out;
}

@keyframes ripple {
  0% {
    opacity: 0.3;
    transform: scale(0);
  }
  100% {
    opacity: 0;
    transform: scale(2);
  }
}

.mobile-btn:active {
  transform: scale(0.92);
}

.mobile-btn.disabled {
  opacity: 0.3;
  pointer-events: none;
}

.mobile-btn.active {
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  box-shadow: 
    0 4px 12px -2px rgba(99, 102, 241, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.mobile-btn.menu-open {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

/* ============================================
   DROPDOWN MENU
   ============================================ */

.more-tools-container {
  position: relative;
}

.more-dropdown {
  position: absolute;
  bottom: calc(100% + 14px);
  right: -8px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 18px;
  padding: 8px;
  box-shadow: 
    0 12px 48px -12px rgba(0, 0, 0, 0.25),
    0 8px 24px -8px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  min-width: 180px;
  transform-origin: bottom right;
  overflow: hidden;
}

.dark .more-dropdown {
  box-shadow: 
    0 12px 48px -16px rgba(0, 0, 0, 0.3),
    0 8px 24px -10px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.dropdown-accent {
  position: absolute;
  top: 0;
  right: 20px;
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 0 0 2px 2px;
}

.dropdown-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-leave-active {
  transition: all 0.15s ease-in;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.dropdown-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.dropdown-item-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.dropdown-item-check {
  color: var(--color-accent-primary);
}

.dropdown-item:active {
  transform: scale(0.98);
}

.dropdown-item:hover {
  background: var(--color-toolbar-hover);
}

.dropdown-item:hover .dropdown-item-icon {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.dropdown-item.active {
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
}

.dropdown-item.active .dropdown-item-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.dropdown-item.active .dropdown-item-check {
  color: white;
}

.dropdown-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-toolbar-border) 10%,
    var(--color-toolbar-border) 90%,
    transparent 100%
  );
  margin: 6px 0;
}
</style>
