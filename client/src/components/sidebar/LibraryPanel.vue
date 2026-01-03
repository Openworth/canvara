<script setup lang="ts">
import { ref } from 'vue'
import { useLibraryStore } from '../../stores/library'
import { useCanvasStore } from '../../stores/canvas'
import ToolIcon from '../toolbar/ToolIcon.vue'

const libraryStore = useLibraryStore()
const canvasStore = useCanvasStore()

const dragItem = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDragStart(e: DragEvent, itemId: string) {
  dragItem.value = itemId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', itemId)
  }
}

function handleDragEnd() {
  dragItem.value = null
}

function handleItemClick(itemId: string) {
  const elements = libraryStore.getItemElements(itemId)
  if (!elements) return

  // Add to canvas at center
  const canvasCenter = {
    x: -canvasStore.appState.scrollX / canvasStore.zoom + 400,
    y: -canvasStore.appState.scrollY / canvasStore.zoom + 300,
  }

  elements.forEach(el => {
    el.x += canvasCenter.x
    el.y += canvasCenter.y
    canvasStore.addElement(el)
  })

  canvasStore.selectElements(elements.map(el => el.id))
}

function handleAddSelected() {
  const selected = canvasStore.selectedElements
  if (selected.length > 0) {
    libraryStore.addToLibrary(selected)
  }
}

function handleExport() {
  const data = libraryStore.exportLibrary()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'canvara-library.json'
  a.click()
  
  URL.revokeObjectURL(url)
}

function handleImportClick() {
  fileInput.value?.click()
}

function handleImport(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const success = libraryStore.importLibrary(reader.result as string)
    if (!success) {
      alert('Failed to import library. Invalid format.')
    }
  }
  reader.readAsText(file)
  
  // Reset input
  target.value = ''
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-x-4"
    enter-to-class="opacity-100 translate-x-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 -translate-x-4"
  >
    <div
      v-if="libraryStore.isOpen"
      class="absolute left-20 top-20 z-10 w-64 max-h-[calc(100vh-160px)] panel-glass flex flex-col"
    >
      <!-- Header -->
      <div 
        class="flex items-center justify-between p-4"
        style="border-bottom: 1px solid var(--color-toolbar-border);"
      >
        <h3 class="text-sm font-semibold" style="color: var(--color-text-primary);">Library</h3>
        <button
          class="toolbar-button !w-7 !h-7"
          @click="libraryStore.closeLibrary()"
        >
          <ToolIcon name="close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Actions -->
      <div 
        class="flex gap-2 p-3"
        style="border-bottom: 1px solid var(--color-toolbar-border);"
      >
        <button
          class="btn-primary flex-1 !py-2 !text-xs disabled:opacity-50"
          :disabled="canvasStore.selectedElements.length === 0"
          @click="handleAddSelected"
        >
          Add Selected
        </button>
        <button
          class="btn-secondary !py-2 !px-3 !text-xs"
          @click="handleImportClick"
        >
          Import
        </button>
        <button
          class="btn-secondary !py-2 !px-3 !text-xs"
          @click="handleExport"
        >
          Export
        </button>
      </div>

      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImport"
      />

      <!-- Library items -->
      <div class="flex-1 overflow-y-auto p-3">
        <div
          v-if="libraryStore.items.length === 0"
          class="text-center py-8 text-sm leading-relaxed"
          style="color: var(--color-text-secondary);"
        >
          No items in library.<br />
          Select elements and click "Add Selected".
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="item in libraryStore.items"
            :key="item.id"
            class="relative group aspect-square rounded-lg cursor-pointer flex items-center justify-center overflow-hidden transition-all duration-150 hover:ring-2 hover:ring-accent-primary/30"
            style="background-color: var(--color-toolbar-hover); border: 1px solid var(--color-toolbar-border);"
            draggable="true"
            @dragstart="handleDragStart($event, item.id)"
            @dragend="handleDragEnd"
            @click="handleItemClick(item.id)"
          >
            <!-- Simple preview (placeholder) -->
            <div class="text-xs font-medium" style="color: var(--color-text-secondary);">
              {{ item.elements.length }} item{{ item.elements.length > 1 ? 's' : '' }}
            </div>

            <!-- Delete button -->
            <button
              class="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-600"
              @click.stop="libraryStore.removeFromLibrary(item.id)"
            >
              <ToolIcon name="close" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
