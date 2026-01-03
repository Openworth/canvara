<script setup lang="ts">
import { ref, computed } from 'vue'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  close: []
}>()

const isMac = computed(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0)
const modKey = computed(() => isMac.value ? '⌘' : 'Ctrl')

const categories = ['Tools', 'Canvas', 'Edit', 'Layers'] as const
type Category = typeof categories[number]

const activeCategory = ref<Category>('Tools')

const shortcuts = computed(() => ({
  Tools: [
    { keys: ['V'], alt: ['1'], description: 'Selection tool' },
    { keys: ['R'], alt: ['2'], description: 'Rectangle' },
    { keys: ['O'], alt: ['3'], description: 'Ellipse' },
    { keys: ['D'], alt: ['4'], description: 'Diamond' },
    { keys: ['A'], alt: ['5'], description: 'Arrow' },
    { keys: ['L'], alt: ['6'], description: 'Line' },
    { keys: ['P'], alt: ['7'], description: 'Pencil / Free draw' },
    { keys: ['T'], alt: ['8'], description: 'Text' },
    { keys: ['I'], alt: ['9'], description: 'Image' },
    { keys: ['E'], description: 'Eraser' },
    { keys: ['H'], description: 'Hand tool (pan)' },
  ],
  Canvas: [
    { keys: ['Scroll'], description: 'Pan canvas vertically' },
    { keys: ['Shift', 'Scroll'], description: 'Pan canvas horizontally' },
    { keys: [modKey.value, 'Scroll'], description: 'Zoom in/out' },
    { keys: [modKey.value, '+'], description: 'Zoom in' },
    { keys: [modKey.value, '−'], description: 'Zoom out' },
    { keys: [modKey.value, '0'], description: 'Reset zoom to 100%' },
    { keys: ['Space', 'Drag'], description: 'Pan canvas' },
    { keys: [modKey.value, 'G'], description: 'Toggle grid' },
  ],
  Edit: [
    { keys: [modKey.value, 'Z'], description: 'Undo' },
    { keys: [modKey.value, 'Shift', 'Z'], description: 'Redo' },
    { keys: [modKey.value, 'A'], description: 'Select all' },
    { keys: [modKey.value, 'C'], description: 'Copy' },
    { keys: [modKey.value, 'X'], description: 'Cut' },
    { keys: [modKey.value, 'V'], description: 'Paste' },
    { keys: [modKey.value, 'D'], description: 'Duplicate' },
    { keys: ['Del'], description: 'Delete selected' },
    { keys: ['Esc'], description: 'Deselect all' },
    { keys: [modKey.value, 'L'], description: 'Open library' },
  ],
  Layers: [
    { keys: ['['], description: 'Send backward' },
    { keys: [']'], description: 'Bring forward' },
    { keys: ['{'], description: 'Send to back' },
    { keys: ['}'], description: 'Bring to front' },
  ],
}))

const currentShortcuts = computed(() => shortcuts.value[activeCategory.value])
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 modal-backdrop"
      @click="emit('close')"
    />

    <!-- Modal -->
    <div class="shortcuts-modal">
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">Keyboard Shortcuts</h2>
        <button
          class="close-button"
          @click="emit('close')"
          aria-label="Close"
        >
          <ToolIcon name="close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Category Tabs -->
      <div class="tabs-container">
        <button
          v-for="category in categories"
          :key="category"
          class="tab-button"
          :class="{ active: activeCategory === category }"
          @click="activeCategory = category"
        >
          {{ category }}
        </button>
      </div>

      <!-- Shortcuts List -->
      <div class="shortcuts-list">
        <div
          v-for="(shortcut, index) in currentShortcuts"
          :key="index"
          class="shortcut-row"
        >
          <span class="shortcut-label">{{ shortcut.description }}</span>
          <div class="keys-container">
            <div class="key-group">
              <kbd v-for="(key, keyIndex) in shortcut.keys" :key="keyIndex" class="key">
                {{ key }}
              </kbd>
            </div>
            <template v-if="'alt' in shortcut && shortcut.alt">
              <span class="key-or">or</span>
              <div class="key-group">
                <kbd v-for="(key, keyIndex) in shortcut.alt" :key="keyIndex" class="key">
                  {{ key }}
                </kbd>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Footer hint -->
      <div class="modal-footer">
        <span class="hint">Press <kbd class="key key-sm">?</kbd> to toggle this dialog</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 75vh;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 24px 48px -12px rgba(0, 0, 0, 0.25);
  border-radius: 16px;
  animation: modalSlideIn 0.2s ease-out;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
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
}

.close-button:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

/* Tabs */
.tabs-container {
  display: flex;
  gap: 4px;
  padding: 0 20px 16px;
}

.tab-button {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-button:hover:not(.active) {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.tab-button.active {
  background: var(--color-accent-primary);
  color: white;
}

/* Shortcuts List */
.shortcuts-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.shortcut-row:last-child {
  border-bottom: none;
}

.shortcut-label {
  font-size: 13px;
  color: var(--color-text-primary);
  flex: 1;
  padding-right: 16px;
}

.keys-container {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.key-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-or {
  font-size: 11px;
  color: var(--color-text-tertiary);
  padding: 0 2px;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-bottom-width: 2px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-ui);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.key-sm {
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  font-size: 10px;
}

/* Footer */
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--color-toolbar-border);
  text-align: center;
}

.hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Scrollbar */
.shortcuts-list::-webkit-scrollbar {
  width: 4px;
}

.shortcuts-list::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-list::-webkit-scrollbar-thumb {
  background: var(--color-toolbar-border);
  border-radius: 2px;
}
</style>
