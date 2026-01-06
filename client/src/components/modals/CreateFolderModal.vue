<script setup lang="ts">
import { ref } from 'vue'
import { useFoldersStore } from '../../stores/folders'
import { FOLDER_COLORS } from '../../../../shared/types'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', folderId: string): void
}>()

const foldersStore = useFoldersStore()

const name = ref('')
const selectedColor = ref(FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)])
const isCreating = ref(false)
const error = ref('')

async function handleCreate() {
  if (!name.value.trim()) {
    error.value = 'Folder name is required'
    return
  }

  isCreating.value = true
  error.value = ''

  const folder = await foldersStore.createFolder(name.value.trim(), selectedColor.value)

  isCreating.value = false

  if (folder) {
    emit('created', folder.id)
    emit('close')
  } else {
    error.value = foldersStore.error || 'Failed to create folder'
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Create Folder</h2>
        <button class="close-btn" @click="emit('close')">
          <ToolIcon name="close" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Folder name</label>
          <input
            v-model="name"
            type="text"
            placeholder="My Projects"
            class="input"
            @keydown.enter="handleCreate"
            autofocus
          />
        </div>

        <div class="form-group">
          <label>Color</label>
          <div class="color-grid">
            <button
              v-for="color in FOLDER_COLORS"
              :key="color"
              class="color-option"
              :class="{ selected: color === selectedColor }"
              :style="{ background: color }"
              @click="selectedColor = color"
            />
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn secondary" @click="emit('close')">Cancel</button>
        <button
          class="btn primary"
          :disabled="!name.trim() || isCreating"
          @click="handleCreate"
        >
          {{ isCreating ? 'Creating...' : 'Create Folder' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--color-toolbar-bg-solid);
  border-radius: 16px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.input {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 10px;
  outline: none;
  transition: all 0.15s ease;
}

.input:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-toolbar-bg-solid);
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: white;
  box-shadow: 0 0 0 3px var(--color-accent-primary);
}

.error-message {
  margin-top: 16px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-toolbar-border);
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn.secondary {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.btn.secondary:hover {
  background: var(--color-toolbar-active);
}

.btn.primary {
  background: var(--color-accent-primary);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: var(--color-accent-secondary);
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

