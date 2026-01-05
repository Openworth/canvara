<script setup lang="ts">
import { useToastStore } from '../../stores/toast'
import ToolIcon from '../toolbar/ToolIcon.vue'

const toastStore = useToastStore()

const typeStyles = {
  info: {
    bg: 'bg-info',
    icon: 'zap',
  },
  success: {
    bg: 'bg-success',
    icon: 'check',
  },
  error: {
    bg: 'bg-error',
    icon: 'close',
  },
  warning: {
    bg: 'bg-warning',
    icon: 'zap',
  },
}
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        :class="['toast', typeStyles[toast.type].bg]"
      >
        <ToolIcon :name="typeStyles[toast.type].icon" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="toastStore.remove(toast.id)">
          <ToolIcon name="close" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
}

.bg-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.bg-success {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.bg-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.bg-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.toast-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Animations */
.toast-enter-active {
  animation: toastIn 0.3s ease;
}

.toast-leave-active {
  animation: toastOut 0.2s ease;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
}
</style>

