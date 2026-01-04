<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import ColorPicker from './ColorPicker.vue'
import StrokeOptions from './StrokeOptions.vue'
import FillOptions from './FillOptions.vue'
import TextOptions from './TextOptions.vue'
import ArrowOptions from './ArrowOptions.vue'
import ToolIcon from '../toolbar/ToolIcon.vue'

const canvasStore = useCanvasStore()

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

// Bottom sheet state for mobile
type SheetState = 'collapsed' | 'peek' | 'expanded'
const sheetState = ref<SheetState>('collapsed')
const isDragging = ref(false)
const dragStartY = ref(0)
const dragCurrentY = ref(0)

// Sheet heights
const COLLAPSED_HEIGHT = 0
const PEEK_HEIGHT = 180
const EXPANDED_HEIGHT = 400

const sheetHeight = computed(() => {
  if (isDragging.value) {
    const dragDelta = dragStartY.value - dragCurrentY.value
    let baseHeight = sheetState.value === 'collapsed' ? COLLAPSED_HEIGHT 
      : sheetState.value === 'peek' ? PEEK_HEIGHT : EXPANDED_HEIGHT
    return Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, baseHeight + dragDelta))
  }
  
  switch (sheetState.value) {
    case 'collapsed': return COLLAPSED_HEIGHT
    case 'peek': return PEEK_HEIGHT
    case 'expanded': return EXPANDED_HEIGHT
  }
})

function handleDragStart(e: TouchEvent | MouseEvent) {
  isDragging.value = true
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  dragStartY.value = clientY
  dragCurrentY.value = clientY
}

function handleDragMove(e: TouchEvent | MouseEvent) {
  if (!isDragging.value) return
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  dragCurrentY.value = clientY
}

function handleDragEnd() {
  if (!isDragging.value) return
  
  const dragDelta = dragStartY.value - dragCurrentY.value
  const currentHeight = sheetHeight.value
  
  // Determine new state based on velocity and position
  if (dragDelta > 50) {
    // Dragging up
    if (sheetState.value === 'collapsed') {
      sheetState.value = 'peek'
    } else if (sheetState.value === 'peek') {
      sheetState.value = 'expanded'
    }
  } else if (dragDelta < -50) {
    // Dragging down
    if (sheetState.value === 'expanded') {
      sheetState.value = 'peek'
    } else if (sheetState.value === 'peek') {
      // Dragging down from peek - dismiss completely
      dismissSheet()
    }
  } else {
    // Snap to nearest state
    if (currentHeight < PEEK_HEIGHT / 2) {
      // Snap to collapsed - dismiss completely
      dismissSheet()
    } else if (currentHeight < (PEEK_HEIGHT + EXPANDED_HEIGHT) / 2) {
      sheetState.value = 'peek'
    } else {
      sheetState.value = 'expanded'
    }
  }
  
  isDragging.value = false
}

// Dismiss the sheet completely by resetting to hand tool
function dismissSheet() {
  sheetState.value = 'collapsed'
  // Reset to hand tool (default mobile tool) to hide the sheet completely
  // This clears selection and switches away from drawing tools
  canvasStore.clearSelection()
  canvasStore.setActiveTool('hand')
}

function toggleSheet() {
  if (sheetState.value === 'collapsed') {
    sheetState.value = 'peek'
  } else if (sheetState.value === 'peek') {
    sheetState.value = 'expanded'
  } else {
    sheetState.value = 'peek'
  }
}

const hasSelection = computed(() => canvasStore.selectedElements.length > 0)
const selectedElement = computed(() => canvasStore.selectedElements[0])
const activeTool = computed(() => canvasStore.activeTool)

// Determine if sidebar should be visible
// Show when: elements are selected OR drawing tools are active (not selection, hand, or eraser)
const shouldShowSidebar = computed(() => {
  if (hasSelection.value) return true
  
  const drawingTools = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text']
  return drawingTools.includes(activeTool.value)
})

// Auto-show sheet when sidebar should be visible on mobile
watch([shouldShowSidebar, isMobile], ([show, mobile]) => {
  if (mobile && show && sheetState.value === 'collapsed') {
    sheetState.value = 'peek'
  }
  if (mobile && !show) {
    sheetState.value = 'collapsed'
  }
})

// Check if we should show arrow options
const showArrowOptions = computed(() => {
  // Show if arrow tool is active
  if (activeTool.value === 'arrow') return true
  // Show if an arrow element is selected
  if (selectedElement.value?.type === 'arrow') return true
  return false
})

// Determine panel mode
const panelMode = computed(() => {
  // If we have a text element selected, show text options
  if (selectedElement.value?.type === 'text') {
    return 'text'
  }
  // If text tool is active, show text options
  if (activeTool.value === 'text') {
    return 'text'
  }
  // If we have a line or arrow selected, show line options
  if (selectedElement.value?.type === 'line' || selectedElement.value?.type === 'arrow') {
    return 'line'
  }
  // If line/arrow tool is active
  if (activeTool.value === 'line' || activeTool.value === 'arrow') {
    return 'line'
  }
  // Default to shape options
  return 'shape'
})

const panelTitle = computed(() => {
  if (hasSelection.value) {
    const type = selectedElement.value?.type
    if (type === 'text') return 'Text'
    if (type === 'line') return 'Line'
    if (type === 'arrow') return 'Arrow'
    if (type === 'freedraw') return 'Drawing'
    if (type === 'rectangle') return 'Rectangle'
    if (type === 'ellipse') return 'Ellipse'
    if (type === 'diamond') return 'Diamond'
    return 'Selection'
  }
  if (activeTool.value === 'text') return 'Text'
  if (activeTool.value === 'line') return 'Line'
  if (activeTool.value === 'arrow') return 'Arrow'
  if (activeTool.value === 'freedraw') return 'Draw'
  if (activeTool.value === 'rectangle') return 'Rectangle'
  if (activeTool.value === 'ellipse') return 'Ellipse'
  if (activeTool.value === 'diamond') return 'Diamond'
  return 'Style'
})

// Icon mapping for panel titles
const panelIcon = computed(() => {
  if (hasSelection.value) {
    const type = selectedElement.value?.type
    if (type === 'text') return 'text'
    if (type === 'line') return 'line'
    if (type === 'arrow') return 'arrow'
    if (type === 'freedraw') return 'pencil'
    if (type === 'rectangle') return 'rectangle'
    if (type === 'ellipse') return 'ellipse'
    if (type === 'diamond') return 'diamond'
    return 'cursor'
  }
  if (activeTool.value === 'text') return 'text'
  if (activeTool.value === 'line') return 'line'
  if (activeTool.value === 'arrow') return 'arrow'
  if (activeTool.value === 'freedraw') return 'pencil'
  if (activeTool.value === 'rectangle') return 'rectangle'
  if (activeTool.value === 'ellipse') return 'ellipse'
  if (activeTool.value === 'diamond') return 'diamond'
  return 'cursor'
})

// Get current values (from selection or defaults)
const strokeColor = computed(() => 
  selectedElement.value?.strokeColor ?? canvasStore.appState.currentItemStrokeColor
)
const backgroundColor = computed(() =>
  selectedElement.value?.backgroundColor ?? canvasStore.appState.currentItemBackgroundColor
)
const strokeWidth = computed(() =>
  selectedElement.value?.strokeWidth ?? canvasStore.appState.currentItemStrokeWidth
)
const strokeStyle = computed(() =>
  selectedElement.value?.strokeStyle ?? canvasStore.appState.currentItemStrokeStyle
)
const fillStyle = computed(() =>
  selectedElement.value?.fillStyle ?? canvasStore.appState.currentItemFillStyle
)
const roughness = computed(() =>
  selectedElement.value?.roughness ?? canvasStore.appState.currentItemRoughness
)
const opacity = computed(() =>
  selectedElement.value?.opacity ?? canvasStore.appState.currentItemOpacity
)
</script>

<template>
  <!-- Desktop: Right sidebar -->
  <Transition
    v-if="!isMobile"
    enter-active-class="sidebar-enter-active"
    enter-from-class="sidebar-enter-from"
    enter-to-class="sidebar-enter-to"
    leave-active-class="sidebar-leave-active"
    leave-from-class="sidebar-leave-from"
    leave-to-class="sidebar-leave-to"
  >
    <div
      v-if="shouldShowSidebar"
      class="sidebar-container"
    >
      <!-- Main panel content -->
      <div class="sidebar-inner">
        <!-- Header with icon and title -->
        <div class="sidebar-header">
          <div class="sidebar-header-icon">
            <ToolIcon :name="panelIcon" class="w-4 h-4" />
          </div>
          <h3 class="sidebar-header-title">{{ panelTitle }}</h3>
        </div>

        <!-- Divider -->
        <div class="sidebar-divider" />

        <!-- Text Options Panel -->
        <div v-if="panelMode === 'text'" class="sidebar-content">
          <TextOptions />
        </div>

        <!-- Shape/Line Options Panel -->
        <div v-else class="sidebar-content">
          <!-- Stroke Color Section -->
          <div class="option-section" style="--section-index: 0;">
            <label class="option-label">Stroke</label>
            <ColorPicker
              :value="strokeColor"
              @change="canvasStore.setStrokeColor($event)"
            />
          </div>

          <!-- Background Color (not for lines) -->
          <div v-if="panelMode === 'shape'" class="option-section" style="--section-index: 1;">
            <label class="option-label">Background</label>
            <ColorPicker
              :value="backgroundColor"
              @change="canvasStore.setBackgroundColor($event)"
            />
          </div>

          <!-- Fill Style (not for lines) -->
          <div v-if="panelMode === 'shape'" class="option-section" style="--section-index: 2;">
            <FillOptions
              :value="fillStyle"
              @change="canvasStore.setFillStyle($event)"
            />
          </div>

          <!-- Stroke Options -->
          <div class="option-section" style="--section-index: 3;">
            <StrokeOptions
              :width="strokeWidth"
              :style="strokeStyle"
              @update:width="canvasStore.setStrokeWidth($event)"
              @update:style="canvasStore.setStrokeStyle($event)"
            />
          </div>

          <!-- Arrow Options (arrowhead styles) -->
          <div v-if="showArrowOptions" class="option-section" style="--section-index: 4;">
            <ArrowOptions />
          </div>

          <!-- Roughness / Sloppiness -->
          <div class="option-section" style="--section-index: 5;">
            <label class="option-label">Sloppiness</label>
            <div class="roughness-buttons">
              <button
                v-for="r in [0, 1, 2]"
                :key="r"
                class="roughness-btn"
                :class="{ 'active': roughness === r }"
                @click="canvasStore.setRoughness(r)"
              >
                {{ r === 0 ? 'None' : r === 1 ? 'Low' : 'High' }}
              </button>
            </div>
          </div>

          <!-- Opacity -->
          <div class="option-section" style="--section-index: 6;">
            <div class="opacity-header">
              <label class="option-label">Opacity</label>
              <span class="opacity-value">{{ opacity }}%</span>
            </div>
            <div class="opacity-slider-container">
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                :value="opacity"
                @input="canvasStore.setOpacity(Number(($event.target as HTMLInputElement).value))"
                class="opacity-slider"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Mobile: Bottom sheet -->
  <div
    v-else-if="shouldShowSidebar"
    class="mobile-sheet"
    :class="{ 'dragging': isDragging }"
    :style="{ height: `${sheetHeight}px` }"
    @touchmove="handleDragMove"
    @touchend="handleDragEnd"
    @mousemove="handleDragMove"
    @mouseup="handleDragEnd"
  >
    <!-- Sheet accent gradient at top -->
    <div class="sheet-accent-gradient" />
    
    <!-- Drag handle -->
    <div
      class="sheet-handle"
      @touchstart.prevent="handleDragStart"
      @mousedown.prevent="handleDragStart"
      @click="toggleSheet"
    >
      <div class="sheet-handle-bar" />
      <div class="sheet-header">
        <div class="sheet-header-icon">
          <ToolIcon :name="panelIcon" class="w-4 h-4" />
        </div>
        <span class="sheet-title">{{ panelTitle }}</span>
      </div>
      <div class="sheet-expand-indicator">
        <ToolIcon 
          name="chevronUp" 
          class="w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-180': sheetState !== 'expanded' }"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="sheet-content">
      <!-- Text Options Panel -->
      <TextOptions v-if="panelMode === 'text'" />

      <!-- Shape/Line Options Panel -->
      <template v-else>
        <!-- Compact color row for peek state -->
        <div v-if="sheetState === 'peek'" class="peek-compact-row">
          <div class="peek-color-section">
            <label class="option-label">Stroke</label>
            <ColorPicker
              :value="strokeColor"
              @change="canvasStore.setStrokeColor($event)"
              compact
            />
          </div>
          <div v-if="panelMode === 'shape'" class="peek-color-section">
            <label class="option-label">Fill</label>
            <ColorPicker
              :value="backgroundColor"
              @change="canvasStore.setBackgroundColor($event)"
              compact
            />
          </div>
        </div>

        <!-- Full options for expanded state -->
        <template v-if="sheetState === 'expanded'">
          <!-- Stroke Color -->
          <div class="option-section">
            <label class="option-label">Stroke</label>
            <ColorPicker
              :value="strokeColor"
              @change="canvasStore.setStrokeColor($event)"
            />
          </div>

          <!-- Background Color (not for lines) -->
          <div v-if="panelMode === 'shape'" class="option-section">
            <label class="option-label">Background</label>
            <ColorPicker
              :value="backgroundColor"
              @change="canvasStore.setBackgroundColor($event)"
            />
          </div>

          <!-- Fill Style (not for lines) -->
          <div v-if="panelMode === 'shape'" class="option-section">
            <FillOptions
              :value="fillStyle"
              @change="canvasStore.setFillStyle($event)"
            />
          </div>

          <!-- Stroke Options -->
          <div class="option-section">
            <StrokeOptions
              :width="strokeWidth"
              :style="strokeStyle"
              @update:width="canvasStore.setStrokeWidth($event)"
              @update:style="canvasStore.setStrokeStyle($event)"
            />
          </div>

          <!-- Arrow Options (arrowhead styles) -->
          <div v-if="showArrowOptions" class="option-section">
            <ArrowOptions />
          </div>

          <!-- Roughness -->
          <div class="option-section">
            <label class="option-label">Sloppiness</label>
            <div class="roughness-buttons">
              <button
                v-for="r in [0, 1, 2]"
                :key="r"
                class="roughness-btn mobile"
                :class="{ 'active': roughness === r }"
                @click="canvasStore.setRoughness(r)"
              >
                {{ r === 0 ? 'None' : r === 1 ? 'Low' : 'High' }}
              </button>
            </div>
          </div>

          <!-- Opacity -->
          <div class="option-section">
            <div class="opacity-header">
              <label class="option-label">Opacity</label>
              <span class="opacity-value">{{ opacity }}%</span>
            </div>
            <div class="opacity-slider-container">
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                :value="opacity"
                @input="canvasStore.setOpacity(Number(($event.target as HTMLInputElement).value))"
                class="opacity-slider"
              />
            </div>
          </div>
        </template>

        <!-- Stroke width quick access for peek state -->
        <div v-if="sheetState === 'peek'" class="peek-stroke-options">
          <StrokeOptions
            :width="strokeWidth"
            :style="strokeStyle"
            @update:width="canvasStore.setStrokeWidth($event)"
            @update:style="canvasStore.setStrokeStyle($event)"
            compact
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   DESKTOP SIDEBAR
   ============================================ */

.sidebar-container {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 240px;
}

.sidebar-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-leave-active {
  transition: all 0.2s ease-in;
}

.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(20px);
}

.sidebar-enter-to,
.sidebar-leave-from {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.sidebar-inner {
  flex: 1;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 14px;
  box-shadow: 
    0 8px 32px -8px rgba(0, 0, 0, 0.12),
    0 4px 16px -4px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.02);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dark .sidebar-inner {
  box-shadow: 
    0 8px 32px -12px rgba(0, 0, 0, 0.25),
    0 4px 16px -6px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.sidebar-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  box-shadow: 0 2px 8px -2px rgba(99, 102, 241, 0.4);
}

.sidebar-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.sidebar-divider {
  height: 1px;
  margin: 0 12px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-toolbar-border) 10%,
    var(--color-toolbar-border) 90%,
    transparent 100%
  );
}

.sidebar-content {
  padding: 12px 16px 16px;
  overflow-y: auto;
  flex: 1;
}

/* ============================================
   OPTION SECTIONS
   ============================================ */

.option-section {
  margin-bottom: 16px;
  animation: sectionFadeIn 0.3s ease forwards;
  animation-delay: calc(var(--section-index, 0) * 0.04s);
  opacity: 0;
}

@keyframes sectionFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.option-section:last-child {
  margin-bottom: 0;
}

.option-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

/* ============================================
   ROUGHNESS BUTTONS
   ============================================ */

.roughness-buttons {
  display: flex;
  gap: 6px;
}

.roughness-btn {
  flex: 1;
  padding: 10px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 8px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.roughness-btn:hover {
  background: var(--color-toolbar-active);
  transform: translateY(-1px);
}

.roughness-btn.active {
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  border-color: transparent;
  box-shadow: 
    0 4px 12px -2px rgba(99, 102, 241, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.roughness-btn.mobile {
  padding: 14px 8px;
  font-size: 12px;
}

/* ============================================
   OPACITY SLIDER
   ============================================ */

.opacity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.opacity-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-accent-primary);
  background: var(--color-accent-glow);
  padding: 2px 8px;
  border-radius: 10px;
}

.opacity-slider-container {
  position: relative;
  padding: 4px 0;
}

.opacity-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--color-toolbar-active) 0%,
    var(--color-accent-primary) 100%
  );
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 
    0 2px 8px -2px rgba(99, 102, 241, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: all 0.15s ease;
}

.opacity-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 
    0 0 0 4px var(--color-accent-glow),
    0 4px 12px -2px rgba(99, 102, 241, 0.5);
}

/* ============================================
   MOBILE BOTTOM SHEET
   ============================================ */

.mobile-sheet {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  left: 12px;
  right: 12px;
  z-index: 40;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 22px;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 
    0 -8px 40px -8px rgba(0, 0, 0, 0.15),
    0 -4px 20px -4px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.dark .mobile-sheet {
  box-shadow: 
    0 -8px 40px -12px rgba(0, 0, 0, 0.25),
    0 -4px 20px -6px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.mobile-sheet.dragging {
  transition: none;
}

.sheet-accent-gradient {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 0 0 2px 2px;
  opacity: 0.8;
}

.sheet-handle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  padding-top: 20px;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  flex-shrink: 0;
}

.sheet-handle:active {
  cursor: grabbing;
}

.sheet-handle-bar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background: var(--color-text-tertiary);
  border-radius: 2px;
  opacity: 0.3;
}

.sheet-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sheet-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  box-shadow: 0 2px 8px -2px rgba(99, 102, 241, 0.4);
}

.sheet-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sheet-expand-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-secondary);
}

.sheet-content {
  padding: 0 16px 16px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ============================================
   PEEK STATE COMPACT LAYOUTS
   ============================================ */

.peek-compact-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.peek-color-section {
  flex: 1;
}

.peek-stroke-options {
  margin-top: 4px;
}
</style>
