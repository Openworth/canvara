<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTagsStore } from '../../stores/tags'
import { TAG_COLORS } from '../../../../shared/types'
import type { Tag } from '../../types'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from './ConfirmModal.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const tagsStore = useTagsStore()

const newTagName = ref('')
const newTagColor = ref<string>(TAG_COLORS[0])
const isCreating = ref(false)
const editingTagId = ref<string | null>(null)
const editingName = ref('')
const editingColor = ref('')
const showDeleteConfirm = ref(false)
const tagToDelete = ref<Tag | null>(null)
const showColorPicker = ref<string | null>(null)

onMounted(() => {
  tagsStore.fetchTags()
})

async function createTag() {
  if (!newTagName.value.trim()) return

  isCreating.value = true
  await tagsStore.createTag(newTagName.value.trim(), newTagColor.value)
  isCreating.value = false

  newTagName.value = ''
  newTagColor.value = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] as string
}

function startEditing(tag: Tag) {
  editingTagId.value = tag.id
  editingName.value = tag.name
  editingColor.value = tag.color
}

function cancelEditing() {
  editingTagId.value = null
  editingName.value = ''
  editingColor.value = ''
}

async function saveEditing(tag: Tag) {
  if (!editingName.value.trim()) {
    cancelEditing()
    return
  }

  const updates: { name?: string; color?: string } = {}
  if (editingName.value.trim() !== tag.name) {
    updates.name = editingName.value.trim()
  }
  if (editingColor.value !== tag.color) {
    updates.color = editingColor.value
  }

  if (Object.keys(updates).length > 0) {
    await tagsStore.updateTag(tag.id, updates)
  }

  cancelEditing()
}

function confirmDelete(tag: Tag) {
  tagToDelete.value = tag
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (tagToDelete.value) {
    await tagsStore.deleteTag(tagToDelete.value.id)
  }
  showDeleteConfirm.value = false
  tagToDelete.value = null
}

function selectColor(color: string, tagId?: string) {
  if (tagId) {
    editingColor.value = color
  } else {
    newTagColor.value = color
  }
  showColorPicker.value = null
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Manage Tags</h2>
        <button class="close-btn" @click="emit('close')">
          <ToolIcon name="close" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Create new tag -->
        <div class="create-section">
          <div class="create-row">
            <button
              class="color-btn"
              :style="{ background: newTagColor }"
              @click="showColorPicker = showColorPicker === 'new' ? null : 'new'"
            />
            <input
              v-model="newTagName"
              type="text"
              placeholder="New tag name..."
              class="tag-input"
              @keydown.enter="createTag"
            />
            <button
              class="add-btn"
              :disabled="!newTagName.trim() || isCreating"
              @click="createTag"
            >
              <ToolIcon name="plus" />
            </button>
          </div>

          <div v-if="showColorPicker === 'new'" class="color-picker">
            <button
              v-for="color in TAG_COLORS"
              :key="color"
              class="color-option"
              :class="{ selected: color === newTagColor }"
              :style="{ background: color }"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <!-- Tags list -->
        <div class="tags-list">
          <div v-if="tagsStore.isLoading" class="loading">
            Loading tags...
          </div>

          <div v-else-if="tagsStore.sortedTags.length === 0" class="empty">
            <ToolIcon name="tag" />
            <p>No tags yet. Create one above!</p>
          </div>

          <div
            v-for="tag in tagsStore.sortedTags"
            :key="tag.id"
            class="tag-row"
          >
            <template v-if="editingTagId === tag.id">
              <button
                class="color-btn"
                :style="{ background: editingColor }"
                @click="showColorPicker = showColorPicker === tag.id ? null : tag.id"
              />
              <input
                v-model="editingName"
                type="text"
                class="tag-input editing"
                @keydown.enter="saveEditing(tag)"
                @keydown.escape="cancelEditing"
                @blur="saveEditing(tag)"
                autofocus
              />
              <div v-if="showColorPicker === tag.id" class="color-picker inline">
                <button
                  v-for="color in TAG_COLORS"
                  :key="color"
                  class="color-option small"
                  :class="{ selected: color === editingColor }"
                  :style="{ background: color }"
                  @click="selectColor(color, tag.id)"
                />
              </div>
            </template>

            <template v-else>
              <span class="tag-dot" :style="{ background: tag.color }" />
              <span class="tag-name">{{ tag.name }}</span>
              <span class="tag-count">{{ tag.projectCount }} projects</span>

              <div class="tag-actions">
                <button class="action-btn" @click="startEditing(tag)">
                  <ToolIcon name="pencil" />
                </button>
                <button class="action-btn delete" @click="confirmDelete(tag)">
                  <ToolIcon name="trash" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn primary" @click="emit('close')">Done</button>
      </div>
    </div>
  </div>

  <!-- Delete confirmation -->
  <ConfirmModal
    v-if="showDeleteConfirm"
    title="Delete Tag"
    :message="`Are you sure you want to delete the tag '${tagToDelete?.name}'? This will remove it from all projects.`"
    confirm-text="Delete"
    cancel-text="Cancel"
    :danger="true"
    @confirm="handleDelete"
    @cancel="showDeleteConfirm = false"
  />
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
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
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
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.create-section {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.create-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.color-btn:hover {
  transform: scale(1.1);
}

.tag-input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 8px;
  outline: none;
  transition: all 0.15s ease;
}

.tag-input:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-toolbar-bg-solid);
}

.tag-input::placeholder {
  color: var(--color-text-tertiary);
}

.tag-input.editing {
  padding: 6px 10px;
  font-size: 13px;
}

.add-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.add-btn:hover:not(:disabled) {
  background: var(--color-accent-secondary);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  background: var(--color-toolbar-hover);
  border-radius: 10px;
}

.color-picker.inline {
  position: absolute;
  left: 40px;
  top: 100%;
  margin-top: 4px;
  z-index: 10;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.color-option {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-option.small {
  width: 22px;
  height: 22px;
}

.color-option:hover {
  transform: scale(1.15);
}

.color-option.selected {
  border-color: white;
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

.tags-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
  text-align: center;
}

.empty :deep(svg) {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty p {
  margin: 0;
  font-size: 14px;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: all 0.15s ease;
  position: relative;
}

.tag-row:hover {
  background: var(--color-toolbar-hover);
}

.tag-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.tag-actions {
  display: none;
  gap: 4px;
}

.tag-row:hover .tag-actions {
  display: flex;
}

.tag-row:hover .tag-count {
  display: none;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-bg-solid);
  border: none;
  border-radius: 6px;
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
  width: 14px;
  height: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
}

.btn {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn.primary {
  background: var(--color-accent-primary);
  color: white;
}

.btn.primary:hover {
  background: var(--color-accent-secondary);
}
</style>

