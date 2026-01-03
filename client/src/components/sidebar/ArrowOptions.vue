<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import type { ArrowHead } from '../../types'

const canvasStore = useCanvasStore()

// Get current values (from selection or defaults)
const selectedElement = computed(() => {
  const selected = canvasStore.selectedElements
  return selected.length === 1 && selected[0].type === 'arrow' ? selected[0] : null
})

const startArrowhead = computed(() =>
  selectedElement.value?.startArrowhead ?? canvasStore.appState.currentItemStartArrowhead
)

const endArrowhead = computed(() =>
  selectedElement.value?.endArrowhead ?? canvasStore.appState.currentItemEndArrowhead
)

const arrowheadOptions: { value: ArrowHead | null; label: string; icon: string }[] = [
  { value: null, label: 'None', icon: 'none' },
  { value: 'arrow', label: 'Arrow', icon: 'arrow' },
  { value: 'triangle', label: 'Triangle', icon: 'triangle' },
  { value: 'bar', label: 'Bar', icon: 'bar' },
  { value: 'dot', label: 'Dot', icon: 'dot' },
]

function setStartArrowhead(value: ArrowHead | null) {
  canvasStore.setStartArrowhead(value)
}

function setEndArrowhead(value: ArrowHead | null) {
  canvasStore.setEndArrowhead(value)
}
</script>

<template>
  <div>
    <!-- Start Arrowhead -->
    <div class="mb-3">
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Start</label>
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="option in arrowheadOptions"
          :key="option.icon + '-start'"
          class="p-1.5 rounded-md transition-colors duration-150 flex items-center justify-center min-w-[28px] min-h-[28px]"
          :class="startArrowhead === option.value ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="startArrowhead !== option.value ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          :title="option.label"
          @click="setStartArrowhead(option.value)"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <template v-if="option.icon === 'none'">
              <line x1="4" y1="10" x2="16" y2="10" />
            </template>
            <template v-else-if="option.icon === 'arrow'">
              <line x1="6" y1="10" x2="16" y2="10" />
              <polyline points="10,6 6,10 10,14" fill="none" />
            </template>
            <template v-else-if="option.icon === 'triangle'">
              <line x1="8" y1="10" x2="16" y2="10" />
              <polygon points="4,10 9,6 9,14" fill="currentColor" stroke="none" />
            </template>
            <template v-else-if="option.icon === 'bar'">
              <line x1="6" y1="10" x2="16" y2="10" />
              <line x1="6" y1="5" x2="6" y2="15" />
            </template>
            <template v-else-if="option.icon === 'dot'">
              <line x1="8" y1="10" x2="16" y2="10" />
              <circle cx="5" cy="10" r="3" fill="currentColor" stroke="none" />
            </template>
          </svg>
        </button>
      </div>
    </div>

    <!-- End Arrowhead -->
    <div>
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">End</label>
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="option in arrowheadOptions"
          :key="option.icon + '-end'"
          class="p-1.5 rounded-md transition-colors duration-150 flex items-center justify-center min-w-[28px] min-h-[28px]"
          :class="endArrowhead === option.value ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="endArrowhead !== option.value ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          :title="option.label"
          @click="setEndArrowhead(option.value)"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <template v-if="option.icon === 'none'">
              <line x1="4" y1="10" x2="16" y2="10" />
            </template>
            <template v-else-if="option.icon === 'arrow'">
              <line x1="4" y1="10" x2="14" y2="10" />
              <polyline points="10,6 14,10 10,14" fill="none" />
            </template>
            <template v-else-if="option.icon === 'triangle'">
              <line x1="4" y1="10" x2="12" y2="10" />
              <polygon points="16,10 11,6 11,14" fill="currentColor" stroke="none" />
            </template>
            <template v-else-if="option.icon === 'bar'">
              <line x1="4" y1="10" x2="14" y2="10" />
              <line x1="14" y1="5" x2="14" y2="15" />
            </template>
            <template v-else-if="option.icon === 'dot'">
              <line x1="4" y1="10" x2="12" y2="10" />
              <circle cx="15" cy="10" r="3" fill="currentColor" stroke="none" />
            </template>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
