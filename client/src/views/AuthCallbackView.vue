<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(async () => {
  const token = route.query.token as string
  
  if (token) {
    authStore.setToken(token)
    await authStore.checkAuth()
    router.push('/')
  } else {
    // No token - redirect to home
    router.push('/?error=auth_failed')
  }
})
</script>

<template>
  <div class="callback-container">
    <div class="callback-content">
      <div class="spinner"></div>
      <p>Completing sign in...</p>
    </div>
  </div>
</template>

<style scoped>
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
}

.callback-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

p {
  color: var(--color-text-secondary);
  font-size: 14px;
}
</style>

