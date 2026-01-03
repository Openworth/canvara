<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  duration?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const isVisible = ref(true)

onMounted(() => {
  if (props.duration !== 0) {
    setTimeout(() => {
      isVisible.value = false
      emit('close')
    }, props.duration || 3000)
  }
})

const bgColor = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
}

const icon = {
  info: 'ℹ️',
  success: '✓',
  error: '✕',
  warning: '⚠',
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    leave-active-class="transition-all duration-200 ease-in"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div
      v-if="isVisible"
      :class="[
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-white',
        bgColor[type || 'info']
      ]"
    >
      <span class="text-lg">{{ icon[type || 'info'] }}</span>
      <span class="text-sm">{{ message }}</span>
      <button
        class="ml-2 opacity-70 hover:opacity-100"
        @click="isVisible = false; emit('close')"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>

