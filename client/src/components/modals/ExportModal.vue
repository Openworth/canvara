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
  // Smaller preview on mobile
  const isMobile = window.innerWidth < 640
  const maxPreviewSize = isMobile ? 200 : 280
  
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
  <div class="export-overlay">
    <!-- Backdrop -->
    <div
      class="export-backdrop"
      @click="emit('close')"
    />

    <!-- Modal / Bottom Sheet -->
    <div class="export-modal">
      <!-- Drag Handle (mobile only) -->
      <div class="drag-handle">
        <div class="drag-handle-bar"></div>
      </div>
      
      <!-- Header -->
      <div class="modal-header">
        <div class="header-title">
          <div class="header-icon">
            <ToolIcon name="download" class="w-4 h-4" />
          </div>
          <h2 class="modal-title">Export</h2>
        </div>
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
        <!-- Format Segmented Control -->
        <div class="format-segment">
          <button
            v-for="format in formats"
            :key="format.value"
            class="segment-btn"
            :class="{ active: exportType === format.value }"
            @click="exportType = format.value"
          >
            {{ format.label }}
          </button>
        </div>

        <!-- Preview Section -->
        <div class="preview-section">
          <div class="preview-container" :class="{ 'no-bg': !withBackground }">
            <template v-if="elementsToExport.length > 0 && exportType !== 'json'">
              <canvas ref="previewCanvas" class="preview-canvas" />
            </template>
            <template v-else-if="exportType === 'json'">
              <div class="preview-placeholder">
                <div class="placeholder-icon json">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 7V4h16v3M9 20h6M12 4v16" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <span class="placeholder-text">{{ elementsToExport.length }} element{{ elementsToExport.length !== 1 ? 's' : '' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="preview-placeholder empty">
                <div class="placeholder-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round"/>
                    <path d="M3 16l5-5 4 4 5-5 4 4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <span class="placeholder-text">No elements to export</span>
              </div>
            </template>
          </div>
          <div v-if="exportDimensions && exportType !== 'json'" class="preview-meta">
            <span class="meta-dimensions">{{ exportDimensions.width }} × {{ exportDimensions.height }}</span>
          </div>
        </div>

        <!-- Options Grid -->
        <div class="options-grid">
          <!-- Background Toggle -->
          <label class="option-card" :class="{ active: withBackground, disabled: exportType === 'json' }">
            <input
              v-model="withBackground"
              type="checkbox"
              class="checkbox-input"
              :disabled="exportType === 'json'"
            />
            <div class="option-toggle" :class="{ on: withBackground }">
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </div>
            <span class="option-label">Background</span>
          </label>

          <!-- Selection Toggle -->
          <label 
            class="option-card"
            :class="{ 
              active: onlySelected, 
              disabled: canvasStore.selectedElements.length === 0 
            }"
          >
            <input
              v-model="onlySelected"
              type="checkbox"
              class="checkbox-input"
              :disabled="canvasStore.selectedElements.length === 0"
            />
            <div class="option-toggle" :class="{ on: onlySelected }">
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </div>
            <span class="option-label">
              Selection
              <span v-if="canvasStore.selectedElements.length > 0" class="option-badge">
                {{ canvasStore.selectedElements.length }}
              </span>
            </span>
          </label>
        </div>

        <!-- Scale Section (PNG only) -->
        <div v-if="exportType === 'png'" class="scale-section">
          <div class="scale-label">Quality</div>
          <div class="scale-segment">
            <button 
              v-for="n in 4" 
              :key="n" 
              class="scale-btn"
              :class="{ active: scale === n }"
              @click="scale = n"
            >
              {{ n }}×
            </button>
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
          Export {{ exportType.toUpperCase() }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Overlay */
.export-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
}

.export-backdrop {
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

/* Modal - Mobile First (Bottom Sheet) */
.export-modal {
  position: relative;
  width: 100%;
  background: var(--color-toolbar-bg-solid);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 60vh;
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
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary, #818cf8));
  border-radius: 6px;
  color: white;
}

.header-icon svg {
  width: 14px;
  height: 14px;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--color-toolbar-hover);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

/* Body */
.modal-body {
  padding: 0 12px 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Format Segmented Control */
.format-segment {
  display: flex;
  background: var(--color-toolbar-hover);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.segment-btn {
  flex: 1;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.segment-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

.segment-btn.active {
  background: var(--color-toolbar-bg-solid);
  color: var(--color-accent-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.dark .segment-btn.active {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* Preview Section */
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 90px;
  background: var(--color-toolbar-hover);
  border-radius: 10px;
  padding: 10px;
  position: relative;
  overflow: hidden;
}

.preview-container.no-bg {
  background-image: 
    linear-gradient(45deg, var(--color-toolbar-active) 25%, transparent 25%),
    linear-gradient(-45deg, var(--color-toolbar-active) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--color-toolbar-active) 75%),
    linear-gradient(-45deg, transparent 75%, var(--color-toolbar-active) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.preview-canvas {
  display: block;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* Let JS control size, don't force stretch */
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px;
}

.placeholder-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-toolbar-active);
  border-radius: 8px;
  color: var(--color-text-tertiary);
}

.placeholder-icon svg {
  width: 18px;
  height: 18px;
}

.placeholder-icon.json {
  background: rgba(99, 102, 241, 0.1);
  color: var(--color-accent-primary);
}

.preview-placeholder.empty .placeholder-icon {
  opacity: 0.5;
}

.placeholder-text {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.preview-meta {
  display: flex;
  justify-content: center;
}

.meta-dimensions {
  font-size: 10px;
  font-family: var(--font-cascadia);
  color: var(--color-text-tertiary);
  background: var(--color-toolbar-hover);
  padding: 3px 8px;
  border-radius: 4px;
}

/* Options Grid */
.options-grid {
  display: flex;
  gap: 8px;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.option-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-toolbar-hover);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.option-card:hover:not(.disabled) {
  background: var(--color-toolbar-active);
}

.option-card.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Toggle Switch */
.option-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
}

.toggle-track {
  position: absolute;
  inset: 0;
  background: var(--color-toolbar-border);
  border-radius: 9px;
  transition: background 0.2s ease;
}

.option-toggle.on .toggle-track {
  background: var(--color-accent-primary);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.option-toggle.on .toggle-thumb {
  transform: translateX(14px);
}

.option-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.option-badge {
  font-size: 10px;
  font-weight: 600;
  color: white;
  background: var(--color-accent-primary);
  padding: 1px 5px;
  border-radius: 4px;
  min-width: 16px;
  text-align: center;
}

/* Scale Section */
.scale-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-toolbar-hover);
  border-radius: 8px;
}

.scale-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.scale-segment {
  display: flex;
  flex: 1;
  background: var(--color-toolbar-bg-solid);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.scale-btn {
  flex: 1;
  padding: 5px 6px;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-cascadia);
  color: var(--color-text-tertiary);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.scale-btn:hover:not(.active) {
  color: var(--color-text-secondary);
  background: var(--color-toolbar-hover);
}

.scale-btn.active {
  background: var(--color-accent-primary);
  color: white;
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 8px;
  padding: 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-toolbar-border);
}

.cancel-button {
  flex: 1;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-toolbar-hover);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover {
  background: var(--color-toolbar-active);
  color: var(--color-text-primary);
}

.export-button {
  flex: 1.5;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary, #818cf8));
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.export-button:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.export-button:active:not(:disabled) {
  transform: scale(0.98);
}

.export-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Desktop - Centered Modal */
@media (min-width: 640px) {
  .export-overlay {
    align-items: center;
    justify-content: center;
  }

  .export-modal {
    width: auto;
    min-width: 400px;
    max-width: 440px;
    max-height: 90vh;
    border: 1px solid var(--color-toolbar-border);
    border-radius: 20px;
    animation: modalSlideIn 0.2s ease-out;
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

  .drag-handle {
    display: none;
  }

  .modal-header {
    padding: 20px 20px 16px;
  }

  .modal-body {
    padding: 0 20px 20px;
    gap: 20px;
  }

  .preview-container {
    min-height: 160px;
    padding: 20px;
  }

  .preview-canvas {
    /* JS controls sizing */
  }

  .modal-footer {
    padding: 16px 20px 20px;
  }

  .cancel-button,
  .export-button {
    padding: 12px 16px;
    font-size: 14px;
    border-radius: 10px;
  }

  .export-button {
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }
}

/* Dark mode adjustments */
.dark .export-modal {
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
}

.dark .segment-btn.active {
  background: var(--color-toolbar-active);
}

.dark .toggle-thumb {
  background: #f0f0f0;
}

@media (min-width: 640px) {
  .dark .export-modal {
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 24px 48px -12px rgba(0, 0, 0, 0.6);
  }
}
</style>
