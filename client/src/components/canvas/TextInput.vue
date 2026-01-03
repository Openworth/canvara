<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'
import type { ExcalidrawElement } from '../../types'

const props = defineProps<{
  element: ExcalidrawElement
  zoom: number
  scrollX: number
  scrollY: number
}>()

const emit = defineEmits<{
  complete: [text: string]
  cancel: []
}>()

const canvasStore = useCanvasStore()
const appStore = useAppStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const text = ref(props.element.text || '')

const style = computed(() => {
  const x = props.element.x * props.zoom + props.scrollX
  const y = props.element.y * props.zoom + props.scrollY
  const fontSize = (props.element.fontSize || 20) * props.zoom

  let fontFamily = 'system-ui, -apple-system, sans-serif'
  if (props.element.fontFamily === 'virgil') {
    fontFamily = '"Caveat", "Virgil", cursive'
  } else if (props.element.fontFamily === 'code') {
    fontFamily = '"Fira Code", "Cascadia Code", monospace'
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
    fontSize: `${fontSize}px`,
    fontFamily,
    color: props.element.strokeColor,
    textAlign: props.element.textAlign || 'left',
    minWidth: `${20 * props.zoom}px`,
    minHeight: `${fontSize * 1.5}px`,
    lineHeight: '1.25',
    whiteSpace: 'pre', // Prevent word wrapping - only break on explicit newlines
    caretColor: appStore.isDarkMode ? '#ffffff' : '#1e1e1e',
  }
})

onMounted(() => {
  // Use setTimeout to ensure the textarea is ready for focus
  setTimeout(() => {
    if (textareaRef.value) {
      textareaRef.value.focus()
      autoResize()
    }
  }, 10)
})

function handleBlur(e: FocusEvent) {
  // Prevent blur from canceling when clicking on sidebar
  const relatedTarget = e.relatedTarget as HTMLElement
  if (relatedTarget?.closest('.sidebar')) {
    textareaRef.value?.focus()
    return
  }
  emit('complete', text.value)
}

function handleKeyDown(e: KeyboardEvent) {
  e.stopPropagation() // Prevent canvas shortcuts from triggering

  if (e.key === 'Escape') {
    emit('cancel')
    e.preventDefault()
  } else if (e.key === 'Enter' && !e.shiftKey) {
    emit('complete', text.value)
    e.preventDefault()
  }
}

function autoResize() {
  if (textareaRef.value) {
    // Reset dimensions to auto to get accurate scroll measurements
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.width = 'auto'
    
    // Calculate width based on the longest line
    const fontSize = (props.element.fontSize || 20) * props.zoom
    const minWidth = 20 * props.zoom
    
    // Use scrollWidth for the width (accounts for white-space: pre)
    const contentWidth = textareaRef.value.scrollWidth
    textareaRef.value.style.width = `${Math.max(contentWidth, minWidth)}px`
    
    // Use scrollHeight for height
    textareaRef.value.style.height = `${Math.max(textareaRef.value.scrollHeight, fontSize * 1.5)}px`
  }
}

watch(text, autoResize)
</script>

<template>
  <textarea
    ref="textareaRef"
    v-model="text"
    :style="style"
    class="absolute bg-transparent border-none outline-none resize-none overflow-hidden z-50 p-0 m-0"
    placeholder="Start typing..."
    @blur="handleBlur"
    @keydown="handleKeyDown"
    @input="autoResize"
  />
</template>

<style scoped>
textarea::placeholder {
  color: #9ca3af;
  opacity: 0.6;
}
</style>

