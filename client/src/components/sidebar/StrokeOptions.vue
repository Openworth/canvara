<script setup lang="ts">
import type { StrokeStyle } from '../../types'

defineProps<{
  width: number
  style: StrokeStyle
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:width': [width: number]
  'update:style': [style: StrokeStyle]
}>()

const widths = [1, 2, 4, 6]
const styles: { value: StrokeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]
</script>

<template>
  <!-- Compact mode: single row with width and style -->
  <div v-if="compact" class="flex gap-3">
    <div class="flex-1">
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Width</label>
      <div class="flex gap-1">
        <button
          v-for="w in widths"
          :key="w"
          class="compact-option-btn"
          :class="{ active: width === w }"
          @click="emit('update:width', w)"
        >
          <div
            class="rounded-full"
            :style="{ width: `${Math.min(w * 2, 10)}px`, height: `${Math.min(w * 2, 10)}px`, backgroundColor: 'currentColor' }"
          />
        </button>
      </div>
    </div>
    <div class="flex-1">
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Style</label>
      <div class="flex gap-1">
        <button
          v-for="s in styles"
          :key="s.value"
          class="compact-option-btn"
          :class="{ active: style === s.value }"
          @click="emit('update:style', s.value)"
        >
          <svg viewBox="0 0 20 2" class="w-4 h-0.5">
            <line
              x1="0"
              y1="1"
              x2="20"
              y2="1"
              stroke="currentColor"
              stroke-width="2"
              :stroke-dasharray="s.value === 'dashed' ? '4,3' : s.value === 'dotted' ? '2,3' : 'none'"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Full mode -->
  <div v-else>
    <!-- Stroke Width -->
    <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Stroke Width</label>
    <div class="flex gap-1 mb-3">
      <button
        v-for="w in widths"
        :key="w"
        class="flex-1 py-1.5 flex items-center justify-center rounded-md transition-colors duration-150"
        :class="width === w ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
        :style="width !== w ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
        @click="emit('update:width', w)"
      >
        <div
          class="rounded-full"
          :style="{ width: `${Math.min(w * 2.5, 12)}px`, height: `${Math.min(w * 2.5, 12)}px`, backgroundColor: 'currentColor' }"
        />
      </button>
    </div>

    <!-- Stroke Style -->
    <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Stroke Style</label>
    <div class="flex gap-1">
      <button
        v-for="s in styles"
        :key="s.value"
        class="flex-1 py-3 flex items-center justify-center rounded-md transition-colors duration-150"
        :class="style === s.value ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
        :style="style !== s.value ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
        @click="emit('update:style', s.value)"
      >
        <svg viewBox="0 0 30 2" class="w-5 h-0.5">
          <line
            x1="0"
            y1="1"
            x2="30"
            y2="1"
            stroke="currentColor"
            stroke-width="2"
            :stroke-dasharray="s.value === 'dashed' ? '6,4' : s.value === 'dotted' ? '2,4' : 'none'"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.compact-option-btn {
  flex: 1;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.compact-option-btn:active {
  transform: scale(0.95);
}

.compact-option-btn.active {
  background: var(--color-accent-primary);
  color: white;
}
</style>
