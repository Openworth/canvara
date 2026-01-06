<script setup lang="ts">
import { ref } from 'vue'
import type { Folder } from '../../types'
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = defineProps<{
  folder: Folder
  isActive: boolean
  isEditing?: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'rename', name: string): void
  (e: 'drop', projectId: string): void
}>()

const editingName = ref('')
const isDragOver = ref(false)

function startEditing() {
  editingName.value = props.folder.name
  emit('edit')
}

function saveEdit() {
  if (editingName.value.trim() && editingName.value !== props.folder.name) {
    emit('rename', editingName.value.trim())
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const projectId = e.dataTransfer?.getData('projectId')
  if (projectId) {
    emit('drop', projectId)
  }
}
</script>

<template>
  <div
    class="folder-item"
    :class="{ active: isActive, 'drag-over': isDragOver }"
    @click="emit('select')"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div class="folder-icon" :style="{ color: folder.color }">
      <ToolIcon name="folder" />
    </div>

    <template v-if="isEditing">
      <input
        v-model="editingName"
        class="folder-name-input"
        type="text"
        @keydown.enter="saveEdit"
        @keydown.escape="emit('edit')"
        @blur="saveEdit"
        @click.stop
        autofocus
      />
    </template>
    <template v-else>
      <span class="folder-name">{{ folder.name }}</span>
      <span class="folder-count">{{ folder.projectCount }}</span>
    </template>

    <div class="folder-actions" @click.stop>
      <button class="action-btn" v-tooltip.right="'Rename'" @click="startEditing">
        <ToolIcon name="pencil" />
      </button>
      <button class="action-btn delete" v-tooltip.right="'Delete'" @click="emit('delete')">
        <ToolIcon name="trash" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.folder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.folder-item:hover {
  background: var(--color-toolbar-hover);
}

.folder-item.active {
  background: var(--color-toolbar-active);
}

.folder-item.drag-over {
  background: rgba(99, 102, 241, 0.15);
  outline: 2px dashed var(--color-accent-primary);
  outline-offset: -2px;
}

.folder-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.folder-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.folder-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-name-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-accent-primary);
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
}

.folder-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  background: var(--color-toolbar-hover);
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.folder-actions {
  display: none;
  gap: 4px;
  position: absolute;
  right: 8px;
}

.folder-item:hover .folder-actions {
  display: flex;
}

.folder-item:hover .folder-count {
  display: none;
}

.action-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.action-btn :deep(svg) {
  width: 12px;
  height: 12px;
}
</style>

