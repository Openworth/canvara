<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'
import ToolIcon from '../toolbar/ToolIcon.vue'
import rough from 'roughjs'

const emit = defineEmits<{
  close: []
}>()

const canvasStore = useCanvasStore()
const appStore = useAppStore()

const exportType = ref<'png' | 'svg' | 'json'>('png')
const withBackground = ref(true)
const onlySelected = ref(false)
const scale = ref(2)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const PADDING_PERCENT = 0.04 // 4% padding

const formats = [
  { value: 'png', label: 'PNG', description: 'Raster image' },
  { value: 'svg', label: 'SVG', description: 'Vector graphics' },
  { value: 'json', label: 'JSON', description: 'Data file' },
] as const

const elementsToExport = computed(() => {
  return onlySelected.value
    ? canvasStore.selectedElements
    : canvasStore.visibleElements
})

const exportBounds = computed(() => {
  const elements = elementsToExport.value
  if (elements.length === 0) return null
  
  const bounds = getBounds(elements)
  const contentWidth = bounds.maxX - bounds.minX
  const contentHeight = bounds.maxY - bounds.minY
  
  // Calculate 4% padding based on the larger dimension
  const maxDimension = Math.max(contentWidth, contentHeight)
  const padding = Math.max(maxDimension * PADDING_PERCENT, 10) // Minimum 10px padding
  
  return {
    ...bounds,
    padding,
    width: contentWidth + padding * 2,
    height: contentHeight + padding * 2
  }
})

const exportDimensions = computed(() => {
  if (!exportBounds.value) return null
  return {
    width: Math.round(exportBounds.value.width * scale.value),
    height: Math.round(exportBounds.value.height * scale.value)
  }
})

// Render preview whenever options change
watch(
  [elementsToExport, withBackground, exportType],
  () => {
    nextTick(() => renderPreview())
  },
  { immediate: true }
)

onMounted(() => {
  renderPreview()
})

function renderPreview() {
  if (!previewCanvas.value || exportType.value === 'json') return
  
  const elements = elementsToExport.value
  if (elements.length === 0) return
  
  const bounds = exportBounds.value
  if (!bounds) return
  
  const canvas = previewCanvas.value
  const maxPreviewSize = 280
  
  // Calculate scale to fit preview
  const previewScale = Math.min(
    maxPreviewSize / bounds.width,
    maxPreviewSize / bounds.height,
    1
  )
  
  const previewWidth = bounds.width * previewScale
  const previewHeight = bounds.height * previewScale
  
  // Set canvas size with device pixel ratio for sharpness
  const dpr = window.devicePixelRatio || 1
  canvas.width = previewWidth * dpr
  canvas.height = previewHeight * dpr
  canvas.style.width = `${previewWidth}px`
  canvas.style.height = `${previewHeight}px`
  
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  
  // Clear and draw background
  ctx.clearRect(0, 0, previewWidth, previewHeight)
  
  if (withBackground.value) {
    ctx.fillStyle = canvasStore.appState.viewBackgroundColor
    ctx.fillRect(0, 0, previewWidth, previewHeight)
  } else {
    // Draw checkerboard pattern for transparency
    drawCheckerboard(ctx, previewWidth, previewHeight)
  }
  
  // Scale and translate to render elements
  ctx.scale(previewScale, previewScale)
  ctx.translate(-bounds.minX + bounds.padding, -bounds.minY + bounds.padding)
  
  // Render elements using shared function
  renderElementsToCanvas(canvas, ctx, elements)
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const size = 8
  const lightColor = appStore.isDarkMode ? '#2a2a2a' : '#ffffff'
  const darkColor = appStore.isDarkMode ? '#1a1a1a' : '#e5e5e5'
  
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? lightColor : darkColor
      ctx.fillRect(x, y, size, size)
    }
  }
}

// Helper to get roughjs options matching the main renderer exactly
function getRoughOptions(el: typeof canvasStore.visibleElements[0]) {
  const dashGap = el.strokeStyle === 'dashed' ? [12, 8] : el.strokeStyle === 'dotted' ? [3, 6] : undefined
  
  return {
    seed: el.seed,
    roughness: el.roughness,
    bowing: el.roughness, // Add bowing for more visible hand-drawn effect
    strokeWidth: el.strokeWidth,
    stroke: el.strokeColor,
    fill: el.backgroundColor !== 'transparent' ? el.backgroundColor : undefined,
    fillStyle: el.fillStyle === 'none' ? undefined : el.fillStyle,
    strokeLineDash: dashGap,
  }
}

// Render rectangle with roundness support matching the main renderer
function renderRectangle(rc: ReturnType<typeof rough.canvas>, el: typeof canvasStore.visibleElements[0], options: ReturnType<typeof getRoughOptions>) {
  const { x, y, width, height, roundness } = el
  
  if (roundness && roundness.type === 3) {
    // For rounded rectangles, use roughjs path with SVG arc commands
    const radius = Math.min(Math.abs(width), Math.abs(height)) * 0.1
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)
    
    // Handle negative dimensions
    const actualX = width < 0 ? x + width : x
    const actualY = height < 0 ? y + height : y
    const actualW = Math.abs(width)
    const actualH = Math.abs(height)
    
    // Create SVG path for rounded rectangle
    const path = `M ${actualX + r} ${actualY} 
      L ${actualX + actualW - r} ${actualY} 
      Q ${actualX + actualW} ${actualY} ${actualX + actualW} ${actualY + r}
      L ${actualX + actualW} ${actualY + actualH - r}
      Q ${actualX + actualW} ${actualY + actualH} ${actualX + actualW - r} ${actualY + actualH}
      L ${actualX + r} ${actualY + actualH}
      Q ${actualX} ${actualY + actualH} ${actualX} ${actualY + actualH - r}
      L ${actualX} ${actualY + r}
      Q ${actualX} ${actualY} ${actualX + r} ${actualY}
      Z`
    
    rc.path(path, options)
  } else {
    rc.rectangle(x, y, width, height, options)
  }
}

// Shared rendering function for both preview and export
function renderElementsToCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, elements: typeof canvasStore.visibleElements) {
  const rc = rough.canvas(canvas)
  
  elements.forEach(el => {
    if (el.isDeleted) return
    
    ctx.save()
    ctx.globalAlpha = el.opacity / 100
    
    if (el.angle) {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      ctx.translate(cx, cy)
      ctx.rotate(el.angle)
      ctx.translate(-cx, -cy)
    }
    
    const options = getRoughOptions(el)
    
    switch (el.type) {
      case 'rectangle':
        renderRectangle(rc, el, options)
        break
      case 'ellipse':
        rc.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, options)
        break
      case 'diamond':
        const dcx = el.x + el.width / 2
        const dcy = el.y + el.height / 2
        rc.polygon([
          [dcx, el.y],
          [el.x + el.width, dcy],
          [dcx, el.y + el.height],
          [el.x, dcy],
        ], options)
        break
      case 'line':
      case 'arrow':
        if (el.points && el.points.length >= 2) {
          const pts: [number, number][] = el.points.map(p => [el.x + p.x, el.y + p.y])
          if (pts.length === 2) {
            rc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], options)
          } else {
            rc.linearPath(pts, options)
          }
          
          // Draw arrowhead at end
          if (el.type === 'arrow' && el.endArrowhead && el.endArrowhead !== 'none') {
            const last = pts[pts.length - 1]
            const prev = pts[pts.length - 2]
            const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0])
            const size = 15 + el.strokeWidth * 2
            
            const p1: [number, number] = [
              last[0] - size * Math.cos(angle - Math.PI / 6),
              last[1] - size * Math.sin(angle - Math.PI / 6),
            ]
            const p2: [number, number] = [
              last[0] - size * Math.cos(angle + Math.PI / 6),
              last[1] - size * Math.sin(angle + Math.PI / 6),
            ]
            rc.linearPath([p1, last, p2], options)
          }
          
          // Draw arrowhead at start
          if (el.type === 'arrow' && el.startArrowhead && el.startArrowhead !== 'none') {
            const first = pts[0]
            const second = pts[1]
            const angle = Math.atan2(first[1] - second[1], first[0] - second[0])
            const size = 15 + el.strokeWidth * 2
            
            const p1: [number, number] = [
              first[0] - size * Math.cos(angle - Math.PI / 6),
              first[1] - size * Math.sin(angle - Math.PI / 6),
            ]
            const p2: [number, number] = [
              first[0] - size * Math.cos(angle + Math.PI / 6),
              first[1] - size * Math.sin(angle + Math.PI / 6),
            ]
            rc.linearPath([p1, first, p2], options)
          }
        }
        break
      case 'freedraw':
        if (el.points && el.points.length >= 2) {
          ctx.strokeStyle = el.strokeColor
          ctx.lineWidth = el.strokeWidth
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          
          if (el.strokeStyle === 'dashed') {
            ctx.setLineDash([12, 8])
          } else if (el.strokeStyle === 'dotted') {
            ctx.setLineDash([3, 6])
          }
          
          ctx.beginPath()
          ctx.moveTo(el.x + el.points[0].x, el.y + el.points[0].y)
          el.points.slice(1).forEach(p => {
            ctx.lineTo(el.x + p.x, el.y + p.y)
          })
          ctx.stroke()
          ctx.setLineDash([])
        }
        break
      case 'text':
        if (el.text) {
          let fontFamily = 'system-ui'
          if (el.fontFamily === 'virgil') {
            fontFamily = '"Caveat", "Virgil", cursive'
          } else if (el.fontFamily === 'code') {
            fontFamily = '"Fira Code", "Cascadia Code", monospace'
          }
          ctx.font = `${el.fontSize}px ${fontFamily}`
          ctx.fillStyle = el.strokeColor
          ctx.textAlign = el.textAlign || 'center'
          ctx.textBaseline = 'middle'
          
          const lines = el.text.split('\n')
          const lineHeight = (el.fontSize || 20) * (el.lineHeight || 1.25)
          const totalTextHeight = lines.length * lineHeight
          
          // Center horizontally
          let tx = el.x + el.width / 2
          if (el.textAlign === 'left') {
            tx = el.x
            ctx.textAlign = 'left'
          } else if (el.textAlign === 'right') {
            tx = el.x + el.width
            ctx.textAlign = 'right'
          }
          
          // Center vertically
          const startY = el.y + (el.height - totalTextHeight) / 2 + lineHeight / 2
          
          lines.forEach((line, i) => {
            ctx.fillText(line, tx, startY + i * lineHeight)
          })
        }
        break
    }
    
    ctx.restore()
  })
}

async function handleExport() {
  const elements = elementsToExport.value

  if (elements.length === 0) {
    alert('No elements to export')
    return
  }

  switch (exportType.value) {
    case 'png':
      await exportPNG(elements)
      break
    case 'svg':
      exportSVG(elements)
      break
    case 'json':
      exportJSON(elements)
      break
  }

  emit('close')
}

async function exportPNG(elements: typeof canvasStore.visibleElements) {
  const bounds = exportBounds.value
  if (!bounds) return
  
  const width = bounds.width * scale.value
  const height = bounds.height * scale.value

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  if (withBackground.value) {
    ctx.fillStyle = canvasStore.appState.viewBackgroundColor
    ctx.fillRect(0, 0, width, height)
  }

  ctx.scale(scale.value, scale.value)
  ctx.translate(-bounds.minX + bounds.padding, -bounds.minY + bounds.padding)

  // Render elements using roughjs for actual export (same as preview)
  renderElementsToCanvas(canvas, ctx, elements)

  const dataUrl = canvas.toDataURL('image/png')
  downloadFile(dataUrl, 'canvara-export.png')
}

function exportSVG(elements: typeof canvasStore.visibleElements) {
  const bounds = exportBounds.value
  if (!bounds) return

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">`

  if (withBackground.value) {
    svg += `<rect width="100%" height="100%" fill="${canvasStore.appState.viewBackgroundColor}"/>`
  }

  elements.forEach(el => {
    const x = el.x - bounds.minX + bounds.padding
    const y = el.y - bounds.minY + bounds.padding

    switch (el.type) {
      case 'rectangle':
        svg += `<rect x="${x}" y="${y}" width="${el.width}" height="${el.height}" fill="${el.backgroundColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity / 100}"/>`
        break
      case 'ellipse':
        svg += `<ellipse cx="${x + el.width / 2}" cy="${y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.backgroundColor}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" opacity="${el.opacity / 100}"/>`
        break
      case 'text':
        svg += `<text x="${x}" y="${y + el.height / 2}" fill="${el.strokeColor}" font-size="${el.fontSize}" dominant-baseline="middle" opacity="${el.opacity / 100}">${el.text || ''}</text>`
        break
    }
  })

  svg += '</svg>'

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, 'canvara-export.svg')
  URL.revokeObjectURL(url)
}

function exportJSON(elements: typeof canvasStore.visibleElements) {
  const data = {
    type: 'canvara',
    version: 1,
    elements,
    appState: {
      viewBackgroundColor: canvasStore.appState.viewBackgroundColor,
    },
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, 'canvara-export.json')
  URL.revokeObjectURL(url)
}

function getBounds(elements: typeof canvasStore.visibleElements) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elements.forEach(el => {
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  })

  return { minX, minY, maxX, maxY }
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 modal-backdrop"
      @click="emit('close')"
    />

    <!-- Modal -->
    <div class="export-modal">
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">Export</h2>
        <button
          class="close-button"
          @click="emit('close')"
          aria-label="Close"
        >
          <ToolIcon name="close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="modal-body">
        <!-- Preview Section -->
        <div class="preview-section">
          <label class="section-label">Preview</label>
          <div class="preview-container" :class="{ 'no-bg': !withBackground }">
            <template v-if="elementsToExport.length > 0 && exportType !== 'json'">
              <canvas ref="previewCanvas" class="preview-canvas" />
              <div v-if="exportDimensions" class="preview-dimensions">
                {{ exportDimensions.width }} × {{ exportDimensions.height }}px
              </div>
            </template>
            <template v-else-if="exportType === 'json'">
              <div class="preview-json">
                <ToolIcon name="download" class="w-8 h-8" />
                <span>{{ elementsToExport.length }} element{{ elementsToExport.length !== 1 ? 's' : '' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="preview-empty">
                <span>No elements to export</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Format Selection -->
        <div class="format-section">
          <label class="section-label">Format</label>
          <div class="format-grid">
            <button
              v-for="format in formats"
              :key="format.value"
              class="format-card"
              :class="{ active: exportType === format.value }"
              @click="exportType = format.value"
            >
              <span class="format-label">{{ format.label }}</span>
              <span class="format-desc">{{ format.description }}</span>
            </button>
          </div>
        </div>

        <!-- Options -->
        <div class="options-section">
          <label class="section-label">Options</label>
          
          <label class="checkbox-row" :class="{ disabled: exportType === 'json' }">
            <div class="checkbox-wrapper">
              <input
                v-model="withBackground"
                type="checkbox"
                class="checkbox-input"
                :disabled="exportType === 'json'"
              />
              <div class="checkbox-box">
                <svg v-if="withBackground" class="checkbox-icon" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <span class="checkbox-label">Include background</span>
          </label>

          <label 
            class="checkbox-row"
            :class="{ disabled: canvasStore.selectedElements.length === 0 }"
          >
            <div class="checkbox-wrapper">
              <input
                v-model="onlySelected"
                type="checkbox"
                class="checkbox-input"
                :disabled="canvasStore.selectedElements.length === 0"
              />
              <div class="checkbox-box">
                <svg v-if="onlySelected" class="checkbox-icon" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="checkbox-label-group">
              <span class="checkbox-label">Export selection only</span>
              <span v-if="canvasStore.selectedElements.length === 0" class="checkbox-hint">No elements selected</span>
              <span v-else class="checkbox-hint">{{ canvasStore.selectedElements.length }} selected</span>
            </div>
          </label>
        </div>

        <!-- Scale (PNG only) -->
        <div v-if="exportType === 'png'" class="scale-section">
          <div class="scale-header">
            <label class="section-label">Scale</label>
            <span class="scale-value">{{ scale }}×</span>
          </div>
          <div class="scale-slider-container">
            <input
              v-model.number="scale"
              type="range"
              min="1"
              max="4"
              step="1"
              class="scale-slider"
            />
            <div class="scale-marks">
              <span v-for="n in 4" :key="n" class="scale-mark" :class="{ active: scale >= n }">{{ n }}×</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="cancel-button" @click="emit('close')">
          Cancel
        </button>
        <button 
          class="export-button" 
          :disabled="elementsToExport.length === 0"
          @click="handleExport"
        >
          <ToolIcon name="download" class="w-4 h-4" />
          Export {{ exportType.toUpperCase() }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 24px 48px -12px rgba(0, 0, 0, 0.25);
  border-radius: 16px;
  animation: modalSlideIn 0.2s ease-out;
  overflow: hidden;
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
  padding: 20px 20px 0;
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

/* Body */
.modal-body {
  padding: 20px;
}

.section-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* Preview Section */
.preview-section {
  margin-bottom: 20px;
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 160px;
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.preview-canvas {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-dimensions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 10px;
  font-family: var(--font-cascadia);
  color: var(--color-text-tertiary);
  background: var(--color-toolbar-bg);
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-toolbar-border);
}

.preview-json {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
}

.preview-json span {
  font-size: 12px;
}

.preview-empty {
  color: var(--color-text-tertiary);
  font-size: 13px;
}

/* Format Section */
.format-section {
  margin-bottom: 20px;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.format-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 8px;
  background: var(--color-toolbar-hover);
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.format-card:hover:not(.active) {
  background: var(--color-toolbar-active);
}

.format-card.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--color-accent-primary);
}

.format-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.format-card.active .format-label {
  color: var(--color-accent-primary);
}

.format-desc {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* Options Section */
.options-section {
  margin-bottom: 20px;
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  cursor: pointer;
}

.checkbox-row.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-wrapper {
  position: relative;
  flex-shrink: 0;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-row.disabled .checkbox-input {
  cursor: not-allowed;
}

.checkbox-box {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-toolbar-border);
  border-radius: 5px;
  background: var(--color-toolbar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.checkbox-input:checked + .checkbox-box {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.checkbox-icon {
  width: 12px;
  height: 12px;
  color: white;
}

.checkbox-row:hover:not(.disabled) .checkbox-box {
  border-color: var(--color-text-tertiary);
}

.checkbox-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-label {
  font-size: 13px;
  color: var(--color-text-primary);
}

.checkbox-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* Scale Section */
.scale-section {
  margin-bottom: 4px;
}

.scale-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.scale-header .section-label {
  margin-bottom: 0;
}

.scale-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent-primary);
  font-family: var(--font-cascadia);
}

.scale-slider-container {
  position: relative;
}

.scale-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-toolbar-hover);
  border-radius: 3px;
  outline: none;
}

.scale-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--color-accent-primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
  transition: transform 0.15s ease;
}

.scale-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.scale-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--color-accent-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.scale-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  padding: 0 2px;
}

.scale-mark {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-family: var(--font-cascadia);
}

.scale-mark.active {
  color: var(--color-text-secondary);
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px 20px;
  border-top: 1px solid var(--color-toolbar-border);
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

.export-button {
  flex: 1.5;
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

.export-button:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
