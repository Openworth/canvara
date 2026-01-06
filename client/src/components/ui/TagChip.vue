<script setup lang="ts">
import type { Tag } from '../../types'
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = defineProps<{
  tag: Tag
  removable?: boolean
  small?: boolean
}>()

const emit = defineEmits<{
  (e: 'remove'): void
}>()

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}
</script>

<template>
  <span
    class="tag-chip"
    :class="{ small, removable }"
    :style="{
      '--tag-color': tag.color,
      '--tag-text': getContrastColor(tag.color),
    }"
  >
    <span class="tag-name">{{ tag.name }}</span>
    <button
      v-if="removable"
      class="remove-btn"
      @click.stop="emit('remove')"
    >
      <ToolIcon name="close" />
    </button>
  </span>
</template>

<style scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--tag-color);
  color: var(--tag-text);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tag-chip.small {
  padding: 2px 6px;
  font-size: 10px;
  gap: 2px;
}

.tag-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  margin: -2px -4px -2px 0;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.remove-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.15);
}

.remove-btn :deep(svg) {
  width: 10px;
  height: 10px;
}
</style>

