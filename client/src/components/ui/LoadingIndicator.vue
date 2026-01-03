<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4">
      <!-- Spinner -->
      <div class="w-10 h-10 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
      
      <!-- Message -->
      <p v-if="message" class="text-gray-700 dark:text-gray-200 text-sm">
        {{ message }}
      </p>
    </div>
  </div>
</template>

