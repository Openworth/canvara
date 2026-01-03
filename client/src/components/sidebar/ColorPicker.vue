<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  value: string
  compact?: boolean
}>()

const emit = defineEmits<{
  change: [color: string]
}>()

const showPicker = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const isInteractingWithColorInput = ref(false)

const colors = [
  '#1e1e1e',
  '#343a40',
  '#495057',
  '#e03131',
  '#c2255c',
  '#9c36b5',
  '#6741d9',
  '#3b5bdb',
  '#1971c2',
  '#0c8599',
  '#099268',
  '#2f9e44',
  '#66a80f',
  '#f08c00',
  '#e8590c',
  '#ffffff',
]

const displayColor = computed(() => {
  if (props.value === 'transparent') {
    return 'transparent'
  }
  return props.value
})

const isTransparent = computed(() => props.value === 'transparent')

function selectColor(color: string) {
  emit('change', color)
  showPicker.value = false
}

function selectColorFromInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('change', target.value)
}

function handleClickOutside(event: MouseEvent) {
  if (isInteractingWithColorInput.value) return
  
  const target = event.target as HTMLElement
  if (
    pickerRef.value && 
    !pickerRef.value.contains(target) &&
    triggerRef.value &&
    !triggerRef.value.contains(target)
  ) {
    showPicker.value = false
  }
}

function handleColorInputMouseDown() {
  isInteractingWithColorInput.value = true
}

function handleColorInputChange(event: Event) {
  selectColorFromInput(event)
  // Small delay before allowing close again
  setTimeout(() => {
    isInteractingWithColorInput.value = false
  }, 100)
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="color-picker-wrapper">
    <!-- Compact mode: just color swatches -->
    <div v-if="compact" class="color-swatches-row">
      <button
        class="compact-swatch transparent-swatch"
        :class="{ 'selected': isTransparent }"
        @click="selectColor('transparent')"
      >
        <span class="checkerboard" />
      </button>
      <button
        v-for="color in colors.slice(0, 8)"
        :key="color"
        class="compact-swatch"
        :class="{ 'selected': color === value, 'is-light': color === '#ffffff' }"
        :style="{ backgroundColor: color }"
        @click="selectColor(color)"
      />
      <button
        class="compact-swatch more-colors"
        @click="showPicker = !showPicker"
      >
        <span style="color: var(--color-text-secondary);">+</span>
      </button>
    </div>

    <!-- Trigger button (non-compact) -->
    <button
      v-if="!compact"
      ref="triggerRef"
      class="color-trigger"
      :class="{ 'is-transparent': isTransparent }"
      @click="showPicker = !showPicker"
    >
      <span 
        class="color-preview"
        :style="{ backgroundColor: isTransparent ? undefined : displayColor }"
      >
        <!-- Checkerboard pattern for transparent -->
        <span v-if="isTransparent" class="checkerboard" />
      </span>
      <span class="color-label">{{ isTransparent ? 'None' : value.toUpperCase() }}</span>
      <svg 
        class="chevron-icon" 
        :class="{ 'rotate': showPicker }"
        width="10" 
        height="10" 
        viewBox="0 0 10 10" 
        fill="none"
      >
        <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Color picker dropdown -->
    <Transition name="dropdown">
      <div
        v-if="showPicker"
        ref="pickerRef"
        class="color-dropdown"
      >
        <!-- Preset colors grid -->
        <div class="color-grid">
          <!-- Transparent option -->
          <button
            class="color-swatch transparent-swatch"
            :class="{ 'selected': isTransparent }"
            @click="selectColor('transparent')"
            v-tooltip.left="'Transparent'"
          >
            <span class="checkerboard" />
            <svg v-if="isTransparent" class="check-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          
          <!-- Color swatches -->
          <button
            v-for="color in colors"
            :key="color"
            class="color-swatch"
            :class="{ 'selected': color === value, 'is-light': color === '#ffffff' }"
            :style="{ backgroundColor: color }"
            @click="selectColor(color)"
            v-tooltip.left="color"
          >
            <svg v-if="color === value" class="check-icon" :class="{ 'dark-check': color === '#ffffff' || color === '#66a80f' || color === '#f08c00' }" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Divider -->
        <div class="picker-divider" />

        <!-- Custom color section -->
        <div class="custom-color-section">
          <label class="custom-label">Custom</label>
          <div class="custom-input-wrapper">
            <input
              type="color"
              :value="value === 'transparent' ? '#ffffff' : value"
              @mousedown="handleColorInputMouseDown"
              @input="handleColorInputChange"
              class="custom-color-input"
            />
            <input
              type="text"
              :value="value === 'transparent' ? '' : value"
              @change="(e) => emit('change', (e.target as HTMLInputElement).value)"
              class="hex-input"
              placeholder="#000000"
              maxlength="7"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.color-picker-wrapper {
  position: relative;
}

.color-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 4px 8px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.color-trigger:hover {
  background: var(--color-toolbar-active);
  border-color: var(--color-text-tertiary);
}

.color-preview {
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--color-toolbar-border);
  overflow: hidden;
  flex-shrink: 0;
}

.color-label {
  flex: 1;
  text-align: left;
  font-size: 11px;
  font-family: 'Fira Code', monospace;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.chevron-icon {
  color: var(--color-text-tertiary);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}

.chevron-icon.rotate {
  transform: rotate(180deg);
}

.checkerboard {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 6px 6px;
  background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
}

.color-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 12px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.color-swatch {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.color-swatch:hover {
  transform: scale(1.1);
  z-index: 1;
}

.color-swatch.is-light {
  border-color: var(--color-toolbar-border);
}

.color-swatch.selected {
  box-shadow: 0 0 0 2px var(--color-toolbar-bg), 0 0 0 3px var(--color-accent-primary);
}

.transparent-swatch {
  border: 1px solid var(--color-toolbar-border);
}

.check-icon {
  color: white;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

.check-icon.dark-check {
  color: var(--color-text-primary);
  filter: none;
}

.picker-divider {
  height: 1px;
  background: var(--color-toolbar-border);
  margin: 10px 0;
}

.custom-color-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  overflow: hidden;
}

.custom-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.custom-input-wrapper {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  overflow: hidden;
}

.custom-color-input {
  width: 32px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--color-toolbar-border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
}

.custom-color-input::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.custom-color-input::-webkit-color-swatch {
  border-radius: 3px;
  border: none;
}

.hex-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: 11px;
  font-family: 'Fira Code', monospace;
  letter-spacing: 0.02em;
}

.hex-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-glow);
}

.hex-input::placeholder {
  color: var(--color-text-tertiary);
}

/* Dropdown animation */
.dropdown-enter-active {
  animation: dropdownIn var(--transition-fast) ease-out;
}

.dropdown-leave-active {
  animation: dropdownOut 0.1s ease-in;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdownOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}

/* Compact mode styles */
.color-swatches-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.compact-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.compact-swatch:active {
  transform: scale(0.95);
}

.compact-swatch.is-light {
  border-color: var(--color-toolbar-border);
}

.compact-swatch.selected {
  box-shadow: 0 0 0 2px var(--color-toolbar-bg), 0 0 0 3px var(--color-accent-primary);
}

.compact-swatch.transparent-swatch {
  border: 1px solid var(--color-toolbar-border);
}

.compact-swatch.more-colors {
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  font-size: 16px;
  font-weight: 500;
}
</style>
