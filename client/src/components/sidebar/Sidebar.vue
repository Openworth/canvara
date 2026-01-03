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
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 translate-x-4"
    enter-to-class="opacity-100 translate-x-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 translate-x-4"
  >
    <div
      v-if="shouldShowSidebar"
      class="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-56 panel-glass p-4"
    >
      <h3 class="text-sm font-semibold mb-4" style="color: var(--color-text-primary);">
        {{ panelTitle }}
      </h3>

      <!-- Text Options Panel -->
      <TextOptions v-if="panelMode === 'text'" />

      <!-- Shape/Line Options Panel -->
      <template v-else>
        <!-- Stroke Color -->
        <div class="mb-4">
          <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Stroke</label>
          <ColorPicker
            :value="strokeColor"
            @change="canvasStore.setStrokeColor($event)"
          />
        </div>

        <!-- Background Color (not for lines) -->
        <div v-if="panelMode === 'shape'" class="mb-4">
          <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Background</label>
          <ColorPicker
            :value="backgroundColor"
            @change="canvasStore.setBackgroundColor($event)"
          />
        </div>

        <!-- Fill Style (not for lines) -->
        <FillOptions
          v-if="panelMode === 'shape'"
          :value="fillStyle"
          @change="canvasStore.setFillStyle($event)"
          class="mb-4"
        />

        <!-- Stroke Options -->
        <StrokeOptions
          :width="strokeWidth"
          :style="strokeStyle"
          @update:width="canvasStore.setStrokeWidth($event)"
          @update:style="canvasStore.setStrokeStyle($event)"
          class="mb-4"
        />

        <!-- Arrow Options (arrowhead styles) -->
        <ArrowOptions v-if="showArrowOptions" class="mb-4" />

        <!-- Roughness -->
        <div class="mb-4">
          <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Sloppiness</label>
          <div class="flex gap-1.5">
            <button
              v-for="r in [0, 1, 2]"
              :key="r"
              class="flex-1 py-2 text-[11px] font-medium rounded-md transition-colors duration-150"
              :class="roughness === r ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
              :style="roughness !== r ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
              @click="canvasStore.setRoughness(r)"
            >
              {{ r === 0 ? 'None' : r === 1 ? 'Low' : 'High' }}
            </button>
          </div>
        </div>

        <!-- Opacity -->
        <div>
          <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">
            Opacity: {{ opacity }}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            :value="opacity"
            @input="canvasStore.setOpacity(Number(($event.target as HTMLInputElement).value))"
            class="w-full"
          />
        </div>
      </template>
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
    <!-- Drag handle -->
    <div
      class="sheet-handle"
      @touchstart.prevent="handleDragStart"
      @mousedown.prevent="handleDragStart"
      @click="toggleSheet"
    >
      <div class="sheet-handle-bar" />
      <span class="sheet-title">{{ panelTitle }}</span>
      <ToolIcon 
        :name="sheetState === 'expanded' ? 'chevronUp' : 'chevronUp'" 
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': sheetState !== 'expanded' }"
        style="color: var(--color-text-secondary);"
      />
    </div>

    <!-- Content -->
    <div class="sheet-content">
      <!-- Text Options Panel -->
      <TextOptions v-if="panelMode === 'text'" />

      <!-- Shape/Line Options Panel -->
      <template v-else>
        <!-- Compact color row for peek state -->
        <div v-if="sheetState === 'peek'" class="flex gap-4 mb-4">
          <div class="flex-1">
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Stroke</label>
            <ColorPicker
              :value="strokeColor"
              @change="canvasStore.setStrokeColor($event)"
              compact
            />
          </div>
          <div v-if="panelMode === 'shape'" class="flex-1">
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Fill</label>
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
          <div class="mb-4">
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Stroke</label>
            <ColorPicker
              :value="strokeColor"
              @change="canvasStore.setStrokeColor($event)"
            />
          </div>

          <!-- Background Color (not for lines) -->
          <div v-if="panelMode === 'shape'" class="mb-4">
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Background</label>
            <ColorPicker
              :value="backgroundColor"
              @change="canvasStore.setBackgroundColor($event)"
            />
          </div>

          <!-- Fill Style (not for lines) -->
          <FillOptions
            v-if="panelMode === 'shape'"
            :value="fillStyle"
            @change="canvasStore.setFillStyle($event)"
            class="mb-4"
          />

          <!-- Stroke Options -->
          <StrokeOptions
            :width="strokeWidth"
            :style="strokeStyle"
            @update:width="canvasStore.setStrokeWidth($event)"
            @update:style="canvasStore.setStrokeStyle($event)"
            class="mb-4"
          />

          <!-- Arrow Options (arrowhead styles) -->
          <ArrowOptions v-if="showArrowOptions" class="mb-4" />

          <!-- Roughness -->
          <div class="mb-4">
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">Sloppiness</label>
            <div class="flex gap-1.5">
              <button
                v-for="r in [0, 1, 2]"
                :key="r"
                class="flex-1 py-3 text-xs font-medium rounded-md transition-colors duration-150"
                :class="roughness === r ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
                :style="roughness !== r ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
                @click="canvasStore.setRoughness(r)"
              >
                {{ r === 0 ? 'None' : r === 1 ? 'Low' : 'High' }}
              </button>
            </div>
          </div>

          <!-- Opacity -->
          <div>
            <label class="text-[11px] font-medium block mb-2" style="color: var(--color-text-secondary);">
              Opacity: {{ opacity }}%
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              :value="opacity"
              @input="canvasStore.setOpacity(Number(($event.target as HTMLInputElement).value))"
              class="w-full"
            />
          </div>
        </template>

        <!-- Stroke width quick access for peek state -->
        <div v-if="sheetState === 'peek'">
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
.mobile-sheet {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px)); /* Above the floating toolbar */
  left: 16px;
  right: 16px;
  z-index: 40;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 20px;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 
    0 -4px 24px -4px rgba(0, 0, 0, 0.12),
    0 -8px 16px -8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.dark .mobile-sheet {
  box-shadow: 
    0 -4px 24px -4px rgba(0, 0, 0, 0.4),
    0 -8px 16px -8px rgba(0, 0, 0, 0.3);
}

.mobile-sheet.dragging {
  transition: none;
}

.sheet-handle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  padding-top: 18px;
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
  width: 36px;
  height: 4px;
  background: var(--color-text-tertiary);
  border-radius: 2px;
  opacity: 0.4;
}

.sheet-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sheet-content {
  padding: 0 16px 16px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
