<script setup lang="ts">
import type { FillStyle } from '../../types'

defineProps<{
  value: FillStyle
}>()

const emit = defineEmits<{
  change: [style: FillStyle]
}>()

const styles: { value: FillStyle; icon: string }[] = [
  { value: 'none', icon: 'none' },
  { value: 'solid', icon: 'solid' },
  { value: 'hachure', icon: 'hachure' },
  { value: 'cross-hatch', icon: 'crosshatch' },
]
</script>

<template>
  <div>
    <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Fill</label>
    <div class="flex gap-1">
      <button
        v-for="s in styles"
        :key="s.value"
        class="flex-1 py-1.5 flex items-center justify-center rounded-md transition-colors duration-150"
        :class="value === s.value ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
        :style="value !== s.value ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
        v-tooltip.left="s.value"
        @click="emit('change', s.value)"
      >
        <!-- None -->
        <svg v-if="s.icon === 'none'" viewBox="0 0 20 20" class="w-3.5 h-3.5">
          <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" rx="2" />
        </svg>

        <!-- Solid -->
        <svg v-else-if="s.icon === 'solid'" viewBox="0 0 20 20" class="w-3.5 h-3.5">
          <rect x="2" y="2" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="1.5" rx="2" />
        </svg>

        <!-- Hachure -->
        <svg v-else-if="s.icon === 'hachure'" viewBox="0 0 20 20" class="w-3.5 h-3.5">
          <defs>
            <pattern id="hachure" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" stroke-width="1" />
            </pattern>
          </defs>
          <rect x="2" y="2" width="16" height="16" fill="url(#hachure)" stroke="currentColor" stroke-width="1.5" rx="2" />
        </svg>

        <!-- Cross-hatch -->
        <svg v-else-if="s.icon === 'crosshatch'" viewBox="0 0 20 20" class="w-3.5 h-3.5">
          <defs>
            <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="4" height="4">
              <line x1="0" y1="0" x2="4" y2="4" stroke="currentColor" stroke-width="0.5" />
              <line x1="4" y1="0" x2="0" y2="4" stroke="currentColor" stroke-width="0.5" />
            </pattern>
          </defs>
          <rect x="2" y="2" width="16" height="16" fill="url(#crosshatch)" stroke="currentColor" stroke-width="1.5" rx="2" />
        </svg>
      </button>
    </div>
  </div>
</template>
