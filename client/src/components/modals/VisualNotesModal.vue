<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVisualNotesStore } from '../../stores/visualNotes'
import { useCanvasStore } from '../../stores/canvas'
import { useAuthStore } from '../../stores/auth'
import { useAppStore } from '../../stores/app'
import { useProjectsStore } from '../../stores/projects'
import ToolIcon from '../toolbar/ToolIcon.vue'
import ConfirmModal from './ConfirmModal.vue'

const emit = defineEmits<{
  close: []
}>()

const visualNotesStore = useVisualNotesStore()
const canvasStore = useCanvasStore()
const authStore = useAuthStore()
const appStore = useAppStore()
const projectsStore = useProjectsStore()

// Fetch remaining uses on mount for free users
onMounted(() => {
  visualNotesStore.fetchRemainingUses()
})

// Free tier usage tracking
const isFreeUser = computed(() => authStore.isAuthenticated && !authStore.isPaidUser)
const isOutOfUses = computed(() => isFreeUser.value && visualNotesStore.remainingUses === 0)

// Tabs
type InputTab = 'image' | 'pdf' | 'text'
const activeTab = ref<InputTab>('image')

// File input refs
const imageInputRef = ref<HTMLInputElement | null>(null)
const pdfInputRef = ref<HTMLInputElement | null>(null)

// Limits (should match server config)
const MAX_TEXT_CHARS = 50000

// State
const selectedFile = ref<File | null>(null)
const textContent = ref('')
const isDragging = ref(false)
const expandContent = ref(false)
const showConfirmation = ref(false)

// Text limit warning
const isNearLimit = computed(() => textContent.value.length > MAX_TEXT_CHARS * 0.8)
const isOverLimit = computed(() => textContent.value.length > MAX_TEXT_CHARS)

// File info display
const fileInfo = computed(() => {
  if (!selectedFile.value) return null
  const size = selectedFile.value.size
  const sizeStr = size > 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${(size / 1024).toFixed(0)} KB`
  return {
    name: selectedFile.value.name,
    size: sizeStr,
    type: selectedFile.value.type,
  }
})

// Validation
const canSubmit = computed(() => {
  if (visualNotesStore.isProcessing) return false
  if (isOutOfUses.value) return false
  if (activeTab.value === 'text') {
    return textContent.value.trim().length > 0 && !isOverLimit.value
  }
  return selectedFile.value !== null
})

// Check if canvas has content
const hasCanvasContent = computed(() => canvasStore.elements.length > 0)

// File handling
function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedFile.value = file
    visualNotesStore.clearError()
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  
  // Validate file type based on active tab
  if (activeTab.value === 'image' && file.type.startsWith('image/')) {
    selectedFile.value = file
    visualNotesStore.clearError()
  } else if (activeTab.value === 'pdf' && file.type === 'application/pdf') {
    selectedFile.value = file
    visualNotesStore.clearError()
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function clearFile() {
  selectedFile.value = null
  if (imageInputRef.value) imageInputRef.value.value = ''
  if (pdfInputRef.value) pdfInputRef.value.value = ''
}

function switchTab(tab: InputTab) {
  activeTab.value = tab
  selectedFile.value = null
  textContent.value = ''
  visualNotesStore.clearError()
}

// Handle generate button click - show confirmation if canvas has content
function handleGenerateClick() {
  if (hasCanvasContent.value) {
    showConfirmation.value = true
  } else {
    handleSubmit()
  }
}

// Cancel confirmation
function cancelConfirmation() {
  showConfirmation.value = false
}

// Submit and generate visualization
async function handleSubmit() {
  showConfirmation.value = false
  
  // For PAID users: disconnect from current project to prevent overwriting
  // For FREE users: no project operations needed, just overwrite localStorage
  if (authStore.isPaidUser) {
    projectsStore.disconnectFromProject()
  }
  
  // Clear the canvas
  canvasStore.clearCanvas()
  
  let result = null
  
  if (activeTab.value === 'text') {
    result = await visualNotesStore.visualizeText(textContent.value, expandContent.value)
  } else if (selectedFile.value) {
    result = await visualNotesStore.visualizeFile(selectedFile.value, expandContent.value)
  }
  
  if (result && result.elements && result.elements.length > 0) {
    const elements = result.elements
    const suggestedName = result.suggestedProjectName || 'Magic Notes'
    
    // Calculate viewport center for positioning
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Reset view to default position for fresh canvas
    canvasStore.appState.scrollX = 0
    canvasStore.appState.scrollY = 0
    canvasStore.appState.zoom.value = 1
    
    // Find the bounding box of generated elements
    let minX = Infinity, minY = Infinity
    elements.forEach(el => {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
    })
    
    // Calculate offset to center elements in viewport
    const viewportCenterX = viewportWidth / 2
    const viewportCenterY = viewportHeight / 2
    const offsetX = viewportCenterX - minX - 200 // Slight offset from center
    const offsetY = viewportCenterY - minY - 100
    
    // Add elements with offset
    const elementIds: string[] = []
    elements.forEach(el => {
      const adjustedElement = {
        ...el,
        x: el.x + offsetX,
        y: el.y + offsetY,
      }
      canvasStore.addElement(adjustedElement)
      elementIds.push(el.id)
    })
    
    // Select all generated elements
    canvasStore.selectElements(elementIds)
    
    // Center on content
    canvasStore.centerOnContent(viewportWidth, viewportHeight)
    
    // Switch to selection tool
    canvasStore.setActiveTool('selection')
    
    // PAID users: Create a new project with the AI-suggested name
    // This ensures Magic Notes output is always saved to a NEW project
    // FREE users: Content stays in localStorage only (handled by canvas store auto-save)
    if (authStore.isPaidUser) {
      await projectsStore.createProject(suggestedName)
    }
    
    // Close modal
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay">
    <!-- Backdrop -->
    <div class="modal-backdrop" @click="emit('close')" />

    <!-- Modal -->
    <div class="modal-container">
      <!-- Drag Handle (mobile) -->
      <div class="drag-handle">
        <div class="drag-handle-bar"></div>
      </div>
      
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <div class="header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 19l1 3 3-1-1-3-3 1z" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18 14l1 3 3-1-1-3-3 1z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="modal-title">Magic Notes</h2>
          <!-- Free tier usage badge -->
          <span 
            v-if="isFreeUser && visualNotesStore.remainingUses !== null" 
            class="usage-badge"
            :class="{ 'out-of-uses': isOutOfUses }"
          >
            {{ visualNotesStore.remainingUses }}/{{ visualNotesStore.dailyLimit }} today
          </span>
        </div>
        <button class="close-button" @click="emit('close')" aria-label="Close">
          <ToolIcon name="close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="modal-body">
        <!-- Tab Selector -->
        <div class="tab-segment">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'image' }"
            @click="switchTab('image')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tab-icon">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Image
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'pdf' }"
            @click="switchTab('pdf')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tab-icon">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M10 13h4" />
              <path d="M10 17h4" />
            </svg>
            PDF
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'text' }"
            @click="switchTab('text')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tab-icon">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
            Text
          </button>
        </div>

        <!-- File Upload Area (Image/PDF) -->
        <div
          v-if="activeTab !== 'text'"
          class="upload-zone"
          :class="{ 
            dragging: isDragging, 
            'has-file': selectedFile,
            processing: visualNotesStore.isProcessing 
          }"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @click="activeTab === 'image' ? imageInputRef?.click() : pdfInputRef?.click()"
        >
          <template v-if="!selectedFile">
            <div class="upload-icon">
              <svg v-if="activeTab === 'image'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>
            <p class="upload-text">
              Drop your {{ activeTab === 'image' ? 'image' : 'PDF' }} here or click to browse
            </p>
            <p class="upload-hint">
              {{ activeTab === 'image' ? 'PNG, JPG, GIF, WebP supported' : 'All pages will be processed' }}
            </p>
          </template>
          <template v-else>
            <div class="file-preview">
              <div class="file-icon">
                <svg v-if="activeTab === 'image'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <div class="file-info">
                <p class="file-name">{{ fileInfo?.name }}</p>
                <p class="file-size">{{ fileInfo?.size }}</p>
              </div>
              <button class="file-remove" @click.stop="clearFile" aria-label="Remove file">
                <ToolIcon name="close" class="w-4 h-4" />
              </button>
            </div>
          </template>
        </div>

        <!-- Text Input Area -->
        <div v-if="activeTab === 'text'" class="text-input-area">
          <textarea
            v-model="textContent"
            class="text-input"
            placeholder="Paste your notes, bullet points, or any text content here...

Example:
• Project overview
• Key features
  - Feature 1
  - Feature 2
• Timeline and milestones"
            rows="8"
            :disabled="visualNotesStore.isProcessing"
          />
          <div 
            class="text-counter"
            :class="{ 'near-limit': isNearLimit, 'over-limit': isOverLimit }"
          >
            {{ textContent.length.toLocaleString() }} / {{ MAX_TEXT_CHARS.toLocaleString() }}
          </div>
        </div>

        <!-- Expand Content Toggle -->
        <label class="expand-toggle">
          <div class="toggle-content">
            <div class="toggle-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toggle-icon">
                <path d="M12 3v18M3 12h18" stroke-linecap="round"/>
                <circle cx="12" cy="12" r="9" opacity="0.3"/>
              </svg>
              <span class="toggle-label">Expand content</span>
            </div>
            <p class="toggle-description">
              AI will subtly add related concepts and fill logical gaps
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="expandContent"
            class="toggle-switch"
            :class="{ active: expandContent }"
            @click="expandContent = !expandContent"
          >
            <span class="toggle-thumb" />
          </button>
        </label>

        <!-- Out of uses message for free users -->
        <div v-if="isOutOfUses" class="out-of-uses-message">
          <div class="out-of-uses-icon">
            <ToolIcon name="zap" class="w-5 h-5" />
          </div>
          <div class="out-of-uses-content">
            <p class="out-of-uses-title">Daily limit reached</p>
            <p class="out-of-uses-text">
              You've used all {{ visualNotesStore.dailyLimit }} free Magic Notes for today. 
              Upgrade to Pro for unlimited access.
            </p>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="visualNotesStore.error && !isOutOfUses" class="error-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <span>{{ visualNotesStore.error }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="cancel-button" @click="emit('close')">
          Cancel
        </button>
        <!-- Show upgrade button when out of uses -->
        <button
          v-if="isOutOfUses"
          class="upgrade-button"
          @click="appStore.openUpgradeModal(); emit('close')"
        >
          <ToolIcon name="zap" class="btn-icon" />
          Upgrade to Pro
        </button>
        <!-- Normal generate button -->
        <button
          v-else
          class="generate-button"
          :disabled="!canSubmit"
          @click="handleGenerateClick"
        >
          <template v-if="visualNotesStore.isProcessing">
            <span class="spinner"></span>
            Generating...
          </template>
          <template v-else>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Generate Visual
          </template>
        </button>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input
      ref="imageInputRef"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      class="hidden"
      @change="handleFileSelect"
    />
    <input
      ref="pdfInputRef"
      type="file"
      accept="application/pdf"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Confirmation Dialog -->
    <Teleport to="body">
      <ConfirmModal
        v-if="showConfirmation"
        :title="authStore.isPaidUser && projectsStore.currentProjectId ? 'Create New Project?' : 'Replace Canvas?'"
        :message="authStore.isPaidUser && projectsStore.currentProjectId 
          ? 'Magic Notes will create a new project with the generated content. Your current project will be saved and remain unchanged.' 
          : 'Magic Notes will replace the current canvas content with the generated visualization. This action cannot be undone.'"
        confirm-text="Generate"
        cancel-text="Cancel"
        :danger="!authStore.isPaidUser || !projectsStore.currentProjectId"
        @confirm="handleSubmit"
        @cancel="cancelConfirmation"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}

/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Modal Container */
.modal-container {
  position: relative;
  width: 100%;
  background: var(--color-toolbar-bg-solid);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Drag Handle */
.drag-handle {
  display: flex;
  justify-content: center;
  padding: 6px 0 2px;
}

.drag-handle-bar {
  width: 32px;
  height: 4px;
  background: var(--color-toolbar-border);
  border-radius: 2px;
  opacity: 0.4;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 12px 10px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

/* Usage Badge */
.usage-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-accent-primary);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.usage-badge.out-of-uses {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

/* Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Tab Selector */
.tab-segment {
  display: flex;
  gap: 4px;
  background: var(--color-toolbar-hover);
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-text-primary);
}

.tab-btn.active {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

/* Upload Zone */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 24px;
  border: 2px dashed var(--color-toolbar-border);
  border-radius: 12px;
  background: var(--color-toolbar-hover);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-zone:hover {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.05);
}

.upload-zone.dragging {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.1);
  transform: scale(1.01);
}

.upload-zone.has-file {
  border-style: solid;
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.05);
}

.upload-zone.processing {
  pointer-events: none;
  opacity: 0.7;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-tertiary);
  margin-bottom: 12px;
}

.upload-icon svg {
  width: 100%;
  height: 100%;
}

.upload-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 4px;
  text-align: center;
}

.upload-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 0;
}

/* File Preview */
.file-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  color: white;
  flex-shrink: 0;
}

.file-icon svg {
  width: 20px;
  height: 20px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 2px 0 0;
}

.file-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.file-remove:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Text Input Area */
.text-input-area {
  position: relative;
}

.text-input {
  width: 100%;
  min-height: 180px;
  padding: 14px;
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.15s ease;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.text-input::placeholder {
  color: var(--color-text-tertiary);
}

.text-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-counter {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  transition: color 0.15s ease;
}

.text-counter.near-limit {
  color: #f59e0b;
}

.text-counter.over-limit {
  color: #ef4444;
  font-weight: 600;
}

/* Expand Toggle */
.expand-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.expand-toggle:hover {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.05);
}

.toggle-content {
  flex: 1;
  min-width: 0;
}

.toggle-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-icon {
  width: 16px;
  height: 16px;
  color: var(--color-accent-primary);
  flex-shrink: 0;
}

.toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.toggle-description {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin: 2px 0 0 24px;
  line-height: 1.4;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--color-toolbar-border);
  border: none;
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(18px);
}

/* Out of Uses Message */
.out-of-uses-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(234, 88, 12, 0.1) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 12px;
}

.out-of-uses-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
  color: white;
  flex-shrink: 0;
}

.out-of-uses-content {
  flex: 1;
}

.out-of-uses-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.out-of-uses-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  color: #ef4444;
  font-size: 13px;
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-toolbar-border);
}

.cancel-button {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover {
  background: var(--color-toolbar-hover);
}

.generate-button {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.generate-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Upgrade Button */
.upgrade-button {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.upgrade-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.btn-icon {
  width: 18px;
  height: 18px;
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Desktop Styles */
@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    justify-content: center;
  }

  .modal-container {
    width: 480px;
    max-height: 80vh;
    border-radius: 16px;
    animation: scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .drag-handle {
    display: none;
  }

  .modal-header {
    padding: 16px 20px;
  }

  .modal-body {
    padding: 0 20px 20px;
  }

  .modal-footer {
    padding: 16px 20px;
  }
}
</style>

