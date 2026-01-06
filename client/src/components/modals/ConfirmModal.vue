<script setup lang="ts">
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div class="confirm-overlay">
      <!-- Backdrop -->
      <div
        class="confirm-backdrop"
        @click="handleCancel"
      />

      <!-- Modal -->
      <div class="confirm-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-content">
          <div 
            class="icon-wrapper"
            :class="{ 'danger': danger }"
          >
            <ToolIcon :name="danger ? 'trash' : 'info'" class="w-5 h-5" />
          </div>
          <h2 class="modal-title">{{ title }}</h2>
        </div>
        <button
          class="close-button"
          @click="handleCancel"
          aria-label="Close"
        >
          <ToolIcon name="close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="modal-body">
        <p class="modal-message">{{ message }}</p>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="cancel-button" @click="handleCancel">
          {{ cancelText }}
        </button>
        <button 
          class="confirm-button" 
          :class="{ 'danger': danger }"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-modal {
  position: relative;
  width: 100%;
  max-width: 360px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 24px 48px -12px rgba(0, 0, 0, 0.25);
  border-radius: 16px;
  animation: modalSlideIn 0.2s ease-out;
  overflow: hidden;
  margin: 16px;
}

.dark .confirm-modal {
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 24px 48px -12px rgba(0, 0, 0, 0.5);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Header */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 0;
  gap: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.icon-wrapper.danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

/* Body */
.modal-body {
  padding: 16px 20px 20px;
}

.modal-message {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0;
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 10px;
  padding: 0 20px 20px;
}

.cancel-button {
  flex: 1;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-toolbar-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.confirm-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  background: var(--color-accent-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-button:hover {
  background: var(--color-accent-hover);
}

.confirm-button.danger {
  background: #ef4444;
}

.confirm-button.danger:hover {
  background: #dc2626;
}
</style>

