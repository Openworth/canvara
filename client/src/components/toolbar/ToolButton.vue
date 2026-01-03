<script setup lang="ts">
import ToolIcon from './ToolIcon.vue'

const props = defineProps<{
  icon: string
  label: string
  shortcut: string
  active?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="toolbar-button"
    :class="{ 'active': active }"
    v-tooltip.right="`${label} (${shortcut})`"
    @click="emit('click')"
  >
    <ToolIcon :name="icon" class="w-4 h-4" />
  </button>
</template>
