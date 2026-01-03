<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import ColorPicker from './ColorPicker.vue'
import type { FontFamily, TextAlign } from '../../types'

const canvasStore = useCanvasStore()

const selectedElement = computed(() => canvasStore.selectedElements[0])

// Get current values (from selection or defaults)
const textColor = computed(() =>
  selectedElement.value?.strokeColor ?? canvasStore.appState.currentItemStrokeColor
)
const fontSize = computed(() =>
  selectedElement.value?.fontSize ?? canvasStore.appState.currentItemFontSize
)
const fontFamily = computed(() =>
  selectedElement.value?.fontFamily ?? canvasStore.appState.currentItemFontFamily
)
const textAlign = computed(() =>
  selectedElement.value?.textAlign ?? canvasStore.appState.currentItemTextAlign
)

const fontSizes = [12, 16, 20, 24, 28, 36, 48, 64, 72]

function setFontSize(size: number) {
  canvasStore.setFontSize(size)
}

function setFontFamily(family: FontFamily) {
  canvasStore.setFontFamily(family)
}

function setTextAlign(align: TextAlign) {
  canvasStore.appState.currentItemTextAlign = align
  if (canvasStore.selectedElementIds.size > 0) {
    canvasStore.selectedElementIds.forEach(id => {
      canvasStore.updateElement(id, { textAlign: align })
    })
    canvasStore.saveToHistory()
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Text Color -->
    <div>
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Color</label>
      <ColorPicker
        :value="textColor"
        @change="canvasStore.setStrokeColor($event)"
      />
    </div>

    <!-- Font Size -->
    <div>
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">
        Size: {{ fontSize }}px
      </label>
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="size in fontSizes"
          :key="size"
          class="py-1 text-[10px] font-medium rounded-md transition-colors duration-150"
          :class="fontSize === size ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="fontSize !== size ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setFontSize(size)"
        >
          {{ size }}
        </button>
      </div>
    </div>

    <!-- Font Family -->
    <div>
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Font</label>
      <div class="flex flex-col gap-1">
        <button
          class="py-1.5 px-2 text-xs font-medium rounded-md transition-colors duration-150 text-left"
          :class="fontFamily === 'virgil' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="fontFamily !== 'virgil' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)', fontFamily: 'Virgil, cursive' } : { fontFamily: 'Virgil, cursive' }"
          @click="setFontFamily('virgil')"
        >
          Hand-drawn
        </button>
        <button
          class="py-1.5 px-2 text-xs font-medium rounded-md transition-colors duration-150 text-left"
          :class="fontFamily === 'normal' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="fontFamily !== 'normal' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setFontFamily('normal')"
        >
          Normal
        </button>
        <button
          class="py-1.5 px-2 text-xs font-medium rounded-md transition-colors duration-150 text-left font-mono"
          :class="fontFamily === 'code' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="fontFamily !== 'code' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setFontFamily('code')"
        >
          Code
        </button>
      </div>
    </div>

    <!-- Text Alignment -->
    <div>
      <label class="text-[11px] font-medium block mb-1.5" style="color: var(--color-text-secondary);">Alignment</label>
      <div class="flex gap-1">
        <button
          class="flex-1 py-1.5 text-[10px] font-medium rounded-md transition-colors duration-150"
          :class="textAlign === 'left' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="textAlign !== 'left' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setTextAlign('left')"
        >
          Left
        </button>
        <button
          class="flex-1 py-1.5 text-[10px] font-medium rounded-md transition-colors duration-150"
          :class="textAlign === 'center' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="textAlign !== 'center' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setTextAlign('center')"
        >
          Center
        </button>
        <button
          class="flex-1 py-1.5 text-[10px] font-medium rounded-md transition-colors duration-150"
          :class="textAlign === 'right' ? 'bg-accent-primary text-white shadow-sm' : 'hover:bg-[var(--color-toolbar-hover)]'"
          :style="textAlign !== 'right' ? { backgroundColor: 'var(--color-toolbar-hover)', color: 'var(--color-text-primary)' } : {}"
          @click="setTextAlign('right')"
        >
          Right
        </button>
      </div>
    </div>
  </div>
</template>
