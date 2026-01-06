<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTagsStore } from '../../stores/tags'
import type { Tag } from '../../types'
import { TAG_COLORS } from '../../../../shared/types'
import ToolIcon from '../toolbar/ToolIcon.vue'
import TagChip from './TagChip.vue'

const props = defineProps<{
  selectedTagIds: string[]
  projectId?: string
}>()

const emit = defineEmits<{
  (e: 'select', tagIds: string[]): void
  (e: 'close'): void
}>()

const tagsStore = useTagsStore()

const newTagName = ref('')
const newTagColor = ref<string>(TAG_COLORS[0])
const isCreating = ref(false)
const showColorPicker = ref(false)

const availableTags = computed(() => {
  return tagsStore.sortedTags.filter(t => !props.selectedTagIds.includes(t.id))
})

const selectedTags = computed(() => {
  return props.selectedTagIds
    .map(id => tagsStore.tags.find(t => t.id === id))
    .filter(Boolean) as Tag[]
})

function toggleTag(tagId: string) {
  if (props.selectedTagIds.includes(tagId)) {
    emit('select', props.selectedTagIds.filter(id => id !== tagId))
  } else {
    emit('select', [...props.selectedTagIds, tagId])
  }
}

function removeTag(tagId: string) {
  emit('select', props.selectedTagIds.filter(id => id !== tagId))
}

async function createTag() {
  if (!newTagName.value.trim()) return

  isCreating.value = true
  const tag = await tagsStore.createTag(newTagName.value.trim(), newTagColor.value)
  isCreating.value = false

  if (tag) {
    emit('select', [...props.selectedTagIds, tag.id])
    newTagName.value = ''
    newTagColor.value = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] as string
  }
}

function selectColor(color: string) {
  newTagColor.value = color
  showColorPicker.value = false
}
</script>

<template>
  <div class="tag-picker" @click.stop>
    <!-- Selected Tags -->
    <div v-if="selectedTags.length > 0" class="selected-tags">
      <TagChip
        v-for="tag in selectedTags"
        :key="tag.id"
        :tag="tag"
        removable
        @remove="removeTag(tag.id)"
      />
    </div>

    <!-- Available Tags -->
    <div v-if="availableTags.length > 0" class="available-tags">
      <div class="section-label">Add tags</div>
      <div class="tag-list">
        <button
          v-for="tag in availableTags"
          :key="tag.id"
          class="tag-option"
          :style="{ '--tag-color': tag.color }"
          @click="toggleTag(tag.id)"
        >
          <span class="tag-dot" />
          <span class="tag-name">{{ tag.name }}</span>
        </button>
      </div>
    </div>

    <!-- Create New Tag -->
    <div class="create-tag">
      <div class="section-label">Create new tag</div>
      <div class="create-row">
        <button
          class="color-btn"
          :style="{ background: newTagColor }"
          @click="showColorPicker = !showColorPicker"
        />
        <input
          v-model="newTagName"
          type="text"
          placeholder="Tag name..."
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

      <!-- Color Picker -->
      <div v-if="showColorPicker" class="color-picker">
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
  </div>
</template>

<style scoped>
.tag-picker {
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  padding: 12px;
  min-width: 220px;
  max-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-tertiary);
  margin-bottom: 8px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.available-tags {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 150px;
  overflow-y: auto;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.tag-option:hover {
  background: var(--color-toolbar-hover);
}

.tag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tag-color);
  flex-shrink: 0;
}

.tag-name {
  font-size: 13px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-tag {
  /* Container for create section */
}

.create-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
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
  padding: 6px 10px;
  font-size: 13px;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid transparent;
  border-radius: 6px;
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

.add-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: 6px;
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

.add-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  padding: 8px;
  background: var(--color-toolbar-hover);
  border-radius: 8px;
}

.color-option {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-option:hover {
  transform: scale(1.15);
}

.color-option.selected {
  border-color: white;
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}
</style>

