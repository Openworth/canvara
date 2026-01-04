<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
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

const zoomPercent = computed(() => Math.round(canvasStore.zoom * 100))
</script>

<template>
  <!-- Desktop: Bottom right -->
  <div 
    v-if="!isMobile"
    class="zoom-container absolute bottom-3 right-3 z-10 flex items-center gap-0.5 panel-glass p-0.5"
  >
    <!-- Zoom out -->
    <button
      class="toolbar-button !w-7 !h-7"
      v-tooltip="'Zoom out (Ctrl+-)'"
      @click="canvasStore.zoomOut()"
    >
      <ToolIcon name="minus" class="w-3.5 h-3.5" />
    </button>

    <!-- Zoom level -->
    <button
      class="px-2 py-1 min-w-[48px] text-center text-xs font-medium rounded-md transition-colors duration-150 hover:bg-[var(--color-toolbar-hover)]"
      style="color: var(--color-text-primary);"
      v-tooltip="'Reset zoom (Ctrl+0)'"
      @click="canvasStore.resetZoom()"
    >
      {{ zoomPercent }}%
    </button>

    <!-- Zoom in -->
    <button
      class="toolbar-button !w-7 !h-7"
      v-tooltip="'Zoom in (Ctrl++)'"
      @click="canvasStore.zoomIn()"
    >
      <ToolIcon name="plus" class="w-3.5 h-3.5" />
    </button>

    <!-- Divider -->
    <div class="toolbar-divider-vertical !h-4 !mx-0.5" />

    <!-- Grid + Snap toggle -->
    <button
      class="toolbar-button !w-7 !h-7"
      :class="{ 'active': canvasStore.appState.showGrid }"
      v-tooltip="canvasStore.appState.showGrid ? 'Hide grid & disable snap' : 'Show grid & enable snap'"
      @click="canvasStore.toggleGrid()"
    >
      <ToolIcon name="grid" class="w-3.5 h-3.5" />
    </button>
  </div>

  <!-- Mobile: Hidden - zoom is handled via pinch gestures, grid is in toolbar menu -->
</template>

<style scoped>
/* Mobile zoom is hidden - pinch-to-zoom and grid in toolbar menu */

/* ZoomControls entrance animation */
.zoom-container {
  animation: zoomSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
}

@keyframes zoomSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
