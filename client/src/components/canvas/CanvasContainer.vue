<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useCollaborationStore } from '../../stores/collaboration'
import { useAppStore } from '../../stores/app'
import { Renderer } from '../../engine/renderer'
import { screenToCanvas, getCommonBounds, normalizeElement, isPointInRect, rotatePoint } from '../../engine/math'
import { getElementAtPoint, getElementsInBounds, getTransformHandleAtPoint, getLineEndpointAtPoint, getCursorForHandle } from '../../engine/hitTest'
import { findBindableElement, createBinding } from '../../engine/binding'
import { useTouch } from '../../composables/useTouch'
import TextInput from './TextInput.vue'
import EmptyCanvasHints from './EmptyCanvasHints.vue'
import type { ExcalidrawElement, Point, TransformHandle, PointBinding } from '../../types'

const canvasStore = useCanvasStore()
const collaborationStore = useCollaborationStore()
const appStore = useAppStore()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: Renderer | null = null
let animationFrameId: number | null = null

// Interaction state
const isPointerDown = ref(false)
const isDragging = ref(false)
const isPanning = ref(false)
const isDrawing = ref(false)
const isSelecting = ref(false)
const isResizing = ref(false)
const isEditingText = ref(false)
const editingTextElement = ref<ExcalidrawElement | null>(null)
const isMobileSmartDrag = ref(false) // Track when dragging element in hand tool on mobile

const startPoint = ref<Point | null>(null)
const currentPoint = ref<Point | null>(null)
const activeHandle = ref<TransformHandle | null>(null)
const drawingElement = ref<ExcalidrawElement | null>(null)
const startElementPositions = ref<Map<string, { x: number; y: number }>>(new Map())
const startElementBounds = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const startElementDimensions = ref<Map<string, { x: number; y: number; width: number; height: number; fontSize?: number; points?: Point[] }>>(new Map())

// Arrow binding state
const suggestedBindingStart = ref<ExcalidrawElement | null>(null)
const suggestedBindingEnd = ref<ExcalidrawElement | null>(null)
const pendingStartBinding = ref<PointBinding | null>(null)
const pendingEndBinding = ref<PointBinding | null>(null)

// Cursor state
const cursorStyle = ref('default')

// Modifier keys state
const isShiftPressed = ref(false)

// Mobile detection
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768 || 'ontouchstart' in window
}

// Pinch-to-zoom state
const pinchStartZoom = ref(1)
const pinchStartScrollX = ref(0)
const pinchStartScrollY = ref(0)
const isPinching = ref(false)

// Initialize pinch-to-zoom using touch composable
useTouch(
  () => canvasRef.value,
  {
    onPinchStart: () => {
      // Store the starting zoom and scroll when pinch begins
      pinchStartZoom.value = canvasStore.zoom
      pinchStartScrollX.value = canvasStore.appState.scrollX
      pinchStartScrollY.value = canvasStore.appState.scrollY
      isPinching.value = true
    },
    onPinchMove: (scale: number, center: Point) => {
      if (!canvasRef.value) return
      
      // Calculate new zoom level
      const newZoom = Math.max(0.1, Math.min(10, pinchStartZoom.value * scale))
      
      // Get the center point in screen coordinates relative to canvas
      const rect = canvasRef.value.getBoundingClientRect()
      const centerX = center.x - rect.left
      const centerY = center.y - rect.top
      
      // Calculate the point under the pinch center in canvas coordinates (using start zoom)
      const canvasX = (centerX - pinchStartScrollX.value) / pinchStartZoom.value
      const canvasY = (centerY - pinchStartScrollY.value) / pinchStartZoom.value
      
      // Set new zoom
      canvasStore.setZoom(newZoom)
      
      // Adjust scroll so the pinch center stays fixed
      const newScrollX = centerX - canvasX * newZoom
      const newScrollY = centerY - canvasY * newZoom
      canvasStore.setScroll(newScrollX, newScrollY)
    },
    onPinchEnd: () => {
      isPinching.value = false
    },
    onTwoFingerPan: (delta: Point) => {
      // Pan the canvas with two-finger drag
      canvasStore.pan(delta.x, delta.y)
    },
  }
)

// Initialize renderer
onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  renderer = new Renderer(canvasRef.value)
  resizeCanvas()

  // Start render loop
  render()

  // Event listeners
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  
  // Mobile detection
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // Note: localStorage loading is handled by HomeView to avoid race conditions
})

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('resize', checkMobile)
})

// Watch for changes and broadcast to collaborators
watch(
  () => canvasStore.elements,
  (newElements) => {
    // Note: localStorage saving is handled by the store's debouncedSave
    // Only broadcast if this is a local change, not a remote update we just received
    if (collaborationStore.isConnected && !canvasStore.isReceivingRemoteUpdate) {
      collaborationStore.broadcastUpdate(newElements)
    }
  },
  { deep: true }
)

// Resize canvas to fit container
function resizeCanvas() {
  if (!containerRef.value || !renderer) return
  const { width, height } = containerRef.value.getBoundingClientRect()
  renderer.resize(width, height)
}

// Main render loop
function render() {
  if (!renderer) return

  const bgColor = appStore.isDarkMode ? '#121212' : canvasStore.appState.viewBackgroundColor

  renderer.clear(bgColor)
  renderer.renderGrid(canvasStore.appState, appStore.isDarkMode)
  // Filter out the element being edited so it doesn't show on canvas while typing
  const elementsToRender = isEditingText.value && editingTextElement.value
    ? canvasStore.visibleElements.filter(el => el.id !== editingTextElement.value?.id)
    : canvasStore.visibleElements
  
  renderer.renderElements(
    elementsToRender,
    canvasStore.appState,
    canvasStore.selectedElementIds
  )

  // Render binding highlights
  const bindingHighlights: ExcalidrawElement[] = []
  if (suggestedBindingStart.value) bindingHighlights.push(suggestedBindingStart.value)
  if (suggestedBindingEnd.value) bindingHighlights.push(suggestedBindingEnd.value)
  if (bindingHighlights.length > 0) {
    renderer.renderBindingHighlights(bindingHighlights, canvasStore.appState)
  }

  // Render drawing preview
  if (drawingElement.value) {
    renderer.renderDrawingElement(drawingElement.value, canvasStore.appState)
  }

  // Render selection box
  if (isSelecting.value && startPoint.value && currentPoint.value) {
    renderer.renderSelectionBox(
      startPoint.value.x,
      startPoint.value.y,
      currentPoint.value.x,
      currentPoint.value.y,
      canvasStore.appState
    )
  }

  // Render collaborators
  renderer.renderCollaborators(
    collaborationStore.collaboratorList,
    canvasStore.appState
  )

  animationFrameId = requestAnimationFrame(render)
}

// Get canvas coordinates from mouse event
function getCanvasPoint(e: MouseEvent | TouchEvent): Point {
  const rect = canvasRef.value!.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  return screenToCanvas(
    clientX - rect.left,
    clientY - rect.top,
    canvasStore.appState.scrollX,
    canvasStore.appState.scrollY,
    canvasStore.appState.zoom.value
  )
}

// Pointer down handler
function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return

  // Don't process if we're editing text or pinching
  if (isEditingText.value || isPinching.value) return

  const point = getCanvasPoint(e)
  startPoint.value = point
  currentPoint.value = point

  const tool = canvasStore.activeTool

  // Handle text tool separately - don't capture pointer
  if (tool === 'text') {
    handleTextStart(point)
    return
  }

  canvasRef.value?.setPointerCapture(e.pointerId)
  isPointerDown.value = true

  // Middle mouse button for panning (always)
  if (e.button === 1) {
    isPanning.value = true
    cursorStyle.value = 'grabbing'
    return
  }

  // Hand tool behavior
  if (canvasStore.activeTool === 'hand') {
    // On mobile: smart pan/select/resize - check handles first, then elements
    if (isMobile.value) {
      const selectedElements = canvasStore.selectedElements
      
      // First, check if touching a resize handle on already-selected elements
      if (selectedElements.length > 0) {
        // Check for line/arrow endpoint handles first
        if (selectedElements.length === 1) {
          const el = selectedElements[0]
          if (el.type === 'line' || el.type === 'arrow') {
            const endpointHandle = getLineEndpointAtPoint(el, point, canvasStore.zoom, isMobile.value)
            if (endpointHandle) {
              isMobileSmartDrag.value = true
              activeHandle.value = endpointHandle
              isResizing.value = true
              startElementBounds.value = { x: el.x, y: el.y, width: el.width, height: el.height }
              startElementDimensions.value = new Map([
                [el.id, { 
                  x: el.x, 
                  y: el.y, 
                  width: el.width, 
                  height: el.height,
                  points: el.points ? [...el.points.map(p => ({ ...p }))] : undefined
                }]
              ])
              return
            }
          }
        }

        // Check for regular transform handles (for shapes)
        const bounds = getCommonBounds(selectedElements)
        if (bounds) {
          const angle = selectedElements.length === 1 ? selectedElements[0].angle || 0 : 0
          // Skip regular transform handles for lines/arrows (but allow for freedraw)
          if (!(selectedElements.length === 1 && (selectedElements[0].type === 'line' || selectedElements[0].type === 'arrow'))) {
            const handle = getTransformHandleAtPoint(bounds, point, canvasStore.zoom, angle, isMobile.value)
            if (handle) {
              isMobileSmartDrag.value = true
              activeHandle.value = handle
              isResizing.value = true
              startElementBounds.value = { ...bounds }
              startElementDimensions.value = new Map(
                selectedElements.map(el => [el.id, { 
                  x: el.x, 
                  y: el.y, 
                  width: el.width, 
                  height: el.height,
                  fontSize: el.type === 'text' ? el.fontSize : undefined,
                  points: (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') && el.points 
                    ? [...el.points.map(p => ({ ...p }))] 
                    : undefined
                }])
              )
              return
            }
          }
        }
      }
      
      // Then check if touching an element to select/drag it
      const element = getElementAtPoint(canvasStore.visibleElements, point)
      if (element) {
        // Touching an element - select it and start dragging
        isMobileSmartDrag.value = true
        canvasStore.selectElement(element.id)
        isDragging.value = true
        startElementPositions.value = new Map(
          canvasStore.selectedElements.map(el => [el.id, { x: el.x, y: el.y }])
        )
        cursorStyle.value = 'move'
        return
      }
    }
    // No element or desktop - pan the canvas
    isPanning.value = true
    cursorStyle.value = 'grabbing'
    return
  }

  if (tool === 'selection') {
    handleSelectionStart(point, e.shiftKey)
  } else if (tool === 'eraser') {
    handleEraserStart(point)
  } else {
    // Start drawing a new element
    handleDrawStart(point)
  }
}

function handleSelectionStart(point: Point, addToSelection: boolean) {
  // Check if clicking on a transform handle
  const selectedElements = canvasStore.selectedElements
  if (selectedElements.length > 0) {
    // Check for line/arrow endpoint handles first
    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      if (el.type === 'line' || el.type === 'arrow') {
        const endpointHandle = getLineEndpointAtPoint(el, point, canvasStore.zoom, isMobile.value)
        if (endpointHandle) {
          activeHandle.value = endpointHandle
          isResizing.value = true
          startElementBounds.value = { x: el.x, y: el.y, width: el.width, height: el.height }
          // Store original points for line endpoint dragging
          startElementDimensions.value = new Map([
            [el.id, { 
              x: el.x, 
              y: el.y, 
              width: el.width, 
              height: el.height,
              points: el.points ? [...el.points.map(p => ({ ...p }))] : undefined
            }]
          ])
          return
        }
      }
    }

    const bounds = getCommonBounds(selectedElements)
    if (bounds) {
      // For single element, use its rotation angle for handle detection
      const angle = selectedElements.length === 1 ? selectedElements[0].angle || 0 : 0
      const handle = getTransformHandleAtPoint(bounds, point, canvasStore.zoom, angle, isMobile.value)
      if (handle) {
        activeHandle.value = handle
        isResizing.value = true
        startElementBounds.value = { ...bounds }
        // Store original element dimensions for resize calculation (include fontSize for text, points for point-based elements)
        startElementDimensions.value = new Map(
          selectedElements.map(el => [el.id, { 
            x: el.x, 
            y: el.y, 
            width: el.width, 
            height: el.height,
            fontSize: el.type === 'text' ? el.fontSize : undefined,
            points: (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') && el.points 
              ? [...el.points.map(p => ({ ...p }))] 
              : undefined
          }])
        )
        return
      }

      // Check if clicking inside the selection bounding box - allow drag from anywhere within
      let testPoint = point
      if (angle) {
        // Transform point to local coordinate system if there's rotation
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        testPoint = rotatePoint(point, center, -angle)
      }
      
      if (isPointInRect(testPoint, bounds)) {
        // Before starting drag, check if there's a different element on top at this point
        // This allows clicking on elements that are visually inside/on top of the selected element
        const topElementAtPoint = getElementAtPoint(canvasStore.visibleElements, point)
        if (topElementAtPoint && !canvasStore.isSelected(topElementAtPoint.id)) {
          // There's a different element on top - select it instead of dragging
          canvasStore.selectElement(topElementAtPoint.id, addToSelection)
          isDragging.value = true
          startElementPositions.value = new Map(
            canvasStore.selectedElements.map(el => [el.id, { x: el.x, y: el.y }])
          )
          cursorStyle.value = 'move'
          return
        }
        
        // No different element on top, proceed with dragging the selected elements
        isDragging.value = true
        startElementPositions.value = new Map(
          selectedElements.map(el => [el.id, { x: el.x, y: el.y }])
        )
        cursorStyle.value = 'move'
        return
      }
    }
  }

  // Check if clicking on an element
  const element = getElementAtPoint(canvasStore.visibleElements, point)

  if (element) {
    if (!canvasStore.isSelected(element.id)) {
      canvasStore.selectElement(element.id, addToSelection)
    }
    
    // Start dragging
    isDragging.value = true
    startElementPositions.value = new Map(
      canvasStore.selectedElements.map(el => [el.id, { x: el.x, y: el.y }])
    )
    cursorStyle.value = 'move'
  } else {
    // Start selection box
    if (!addToSelection) {
      canvasStore.clearSelection()
    }
    isSelecting.value = true
  }
}

function handleEraserStart(point: Point) {
  const element = getElementAtPoint(canvasStore.visibleElements, point)
  if (element) {
    canvasStore.deleteElements([element.id])
  }
}

function handleTextStart(point: Point) {
  // Snap position if enabled
  const snapEnabled = canvasStore.appState.snapToGrid && canvasStore.appState.gridSize
  const startX = snapEnabled ? canvasStore.snapValueToGrid(point.x) : point.x
  const startY = snapEnabled ? canvasStore.snapValueToGrid(point.y) : point.y

  // Create a new text element
  const element = canvasStore.createElement('text', startX, startY)
  element.text = ''
  element.width = 100
  element.height = (element.fontSize || 20) * 1.25

  editingTextElement.value = element
  isEditingText.value = true
}

// Helper function to measure text dimensions
function measureTextDimensions(text: string, fontSize: number, fontFamily?: string): { width: number; height: number } {
  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return { width: 100, height: fontSize * 1.25 }

  let font = 'system-ui'
  if (fontFamily === 'virgil') {
    font = '"Caveat", "Virgil", cursive'
  } else if (fontFamily === 'code') {
    font = '"Fira Code", "Cascadia Code", monospace'
  }

  ctx.font = `${fontSize}px ${font}`
  
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.25
  const height = lines.length * lineHeight
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + 10

  return { width, height }
}

function handleTextComplete(text: string) {
  if (editingTextElement.value) {
    // Check if we're editing an existing element
    const existingElement = canvasStore.getElementById(editingTextElement.value.id)
    const fontSize = editingTextElement.value.fontSize || 20

    if (existingElement) {
      // Editing existing text element
      if (text.trim()) {
        const dims = measureTextDimensions(text, fontSize, editingTextElement.value.fontFamily)

        canvasStore.updateElement(editingTextElement.value.id, {
          text,
          originalText: text,
          width: dims.width,
          height: dims.height,
        })
        canvasStore.saveToHistory()
      } else {
        // Empty text - delete the element
        canvasStore.deleteElements([editingTextElement.value.id])
      }
    } else if (text.trim()) {
      // Creating new text element
      const dims = measureTextDimensions(text, fontSize, editingTextElement.value.fontFamily)

      editingTextElement.value.text = text
      editingTextElement.value.originalText = text
      editingTextElement.value.width = dims.width
      editingTextElement.value.height = dims.height

      canvasStore.addElement(editingTextElement.value)
    }
  }

  // Only switch to selection tool if we actually created/edited text
  const createdOrEdited = editingTextElement.value && (
    canvasStore.getElementById(editingTextElement.value.id) || text.trim()
  )
  
  editingTextElement.value = null
  isEditingText.value = false
  
  if (createdOrEdited) {
    // On mobile, switch to pan tool for better touch experience
    canvasStore.setActiveTool(isMobile.value ? 'hand' : 'selection')
  }
}

function handleTextCancel() {
  editingTextElement.value = null
  isEditingText.value = false
  // Keep text tool selected so user can try again
}

function handleDrawStart(point: Point) {
  isDrawing.value = true
  const tool = canvasStore.activeTool

  // Clear any previous binding suggestions
  suggestedBindingStart.value = null
  suggestedBindingEnd.value = null
  pendingStartBinding.value = null
  pendingEndBinding.value = null

  // Snap starting position to grid if enabled
  const snapEnabled = canvasStore.appState.snapToGrid && canvasStore.appState.gridSize
  let startX = snapEnabled ? canvasStore.snapValueToGrid(point.x) : point.x
  let startY = snapEnabled ? canvasStore.snapValueToGrid(point.y) : point.y

  // Check for binding on start point for arrows (don't snap position, just create binding)
  if (tool === 'arrow') {
    const bindableElement = findBindableElement(point, canvasStore.visibleElements)
    if (bindableElement) {
      suggestedBindingStart.value = bindableElement
      pendingStartBinding.value = createBinding(point, bindableElement)
    }
  }

  const element = canvasStore.createElement(
    tool as ExcalidrawElement['type'],
    startX,
    startY
  )

  // Initialize points for line-based elements
  if (tool === 'line' || tool === 'arrow') {
    element.points = [{ x: 0, y: 0 }]
  } else if (tool === 'freedraw') {
    element.points = [{ x: 0, y: 0 }]
  }

  drawingElement.value = element
}

// Pointer move handler
function handlePointerMove(e: PointerEvent) {
  // Skip if pinching (handled by touch composable)
  if (isPinching.value) return

  const point = getCanvasPoint(e)
  currentPoint.value = point
  
  // Track shift key state for constraining shapes
  isShiftPressed.value = e.shiftKey

  // Broadcast cursor position for collaboration
  collaborationStore.broadcastCursor(point)

  // Update cursor based on what's under it
  if (!isPointerDown.value) {
    updateCursor(point)
  }

  if (!isPointerDown.value) return

  if (isPanning.value) {
    const dx = e.movementX
    const dy = e.movementY
    canvasStore.pan(dx, dy)
    return
  }

  if (isDragging.value && startPoint.value) {
    handleDrag(point)
  } else if (isResizing.value && startPoint.value) {
    handleResize(point)
  } else if (isSelecting.value) {
    // Selection box is rendered in the render loop
  } else if (isDrawing.value && drawingElement.value) {
    handleDraw(point)
  } else if (canvasStore.activeTool === 'eraser') {
    const element = getElementAtPoint(canvasStore.visibleElements, point)
    if (element) {
      canvasStore.deleteElements([element.id])
    }
  }
}

function updateCursor(point: Point) {
  const tool = canvasStore.activeTool

  if (tool === 'hand') {
    // On mobile: show pointer when over elements (smart pan/select mode)
    if (isMobile.value) {
      const element = getElementAtPoint(canvasStore.visibleElements, point)
      cursorStyle.value = element ? 'pointer' : 'grab'
    } else {
      cursorStyle.value = 'grab'
    }
    return
  }

  if (tool !== 'selection') {
    cursorStyle.value = 'crosshair'
    return
  }

  // Check transform handles
  const selectedElements = canvasStore.selectedElements
  if (selectedElements.length > 0) {
    // Check for line/arrow endpoint handles first
    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      if (el.type === 'line' || el.type === 'arrow') {
        const endpointHandle = getLineEndpointAtPoint(el, point, canvasStore.zoom, isMobile.value)
        if (endpointHandle) {
          cursorStyle.value = getCursorForHandle(endpointHandle)
          return
        }
      }
    }

    const bounds = getCommonBounds(selectedElements)
    if (bounds) {
      // For single element, use its rotation angle for handle detection
      const angle = selectedElements.length === 1 ? selectedElements[0].angle || 0 : 0
      // Skip regular transform handles for lines/arrows
      if (selectedElements.length === 1 && (selectedElements[0].type === 'line' || selectedElements[0].type === 'arrow')) {
        // Don't show regular handles for lines
      } else {
        const handle = getTransformHandleAtPoint(bounds, point, canvasStore.zoom, angle, isMobile.value)
        if (handle) {
          cursorStyle.value = getCursorForHandle(handle)
          return
        }
      }

      // Check if inside selection bounds - show move cursor
      let testPoint = point
      if (angle) {
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        testPoint = rotatePoint(point, center, -angle)
      }
      
      if (isPointInRect(testPoint, bounds)) {
        cursorStyle.value = 'move'
        return
      }
    }
  }

  // Check if over an element
  const element = getElementAtPoint(canvasStore.visibleElements, point)
  cursorStyle.value = element ? 'move' : 'default'
}

function handleDrag(point: Point) {
  if (!startPoint.value) return

  const dx = point.x - startPoint.value.x
  const dy = point.y - startPoint.value.y

  const updates = new Map<string, Partial<ExcalidrawElement>>()
  const movedIds: string[] = []

  canvasStore.selectedElementIds.forEach(id => {
    const startPos = startElementPositions.value.get(id)
    if (startPos) {
      let newX = startPos.x + dx
      let newY = startPos.y + dy

      // Snap to grid if enabled
      if (canvasStore.appState.snapToGrid && canvasStore.appState.gridSize) {
        newX = canvasStore.snapValueToGrid(newX)
        newY = canvasStore.snapValueToGrid(newY)
      }

      updates.set(id, { x: newX, y: newY })
      movedIds.push(id)
    }
  })

  if (updates.size > 0) {
    // Update elements with proper reactivity (for collaboration sync)
    canvasStore.updateElementsRealtime(updates)
    
    // Update bound arrows
    canvasStore.updateBoundArrows(movedIds)
  }
}

// Handle dragging line/arrow endpoints
function handleLineEndpointDrag(point: Point, handle: 'start' | 'end') {
  const selectedElements = canvasStore.selectedElements
  if (selectedElements.length !== 1) return
  
  const element = selectedElements[0]
  if ((element.type !== 'line' && element.type !== 'arrow') || !element.points) return

  const originalDims = startElementDimensions.value.get(element.id)
  if (!originalDims || !originalDims.points) return

  const snapEnabled = canvasStore.appState.snapToGrid && canvasStore.appState.gridSize
  let targetX = point.x
  let targetY = point.y

  // For arrows, check for binding (don't snap position, just create binding)
  let newBinding: PointBinding | null = null
  if (element.type === 'arrow') {
    // Exclude the element at the other end from binding candidates
    const otherBinding = handle === 'start' ? element.endBinding : element.startBinding
    const excludeIds = otherBinding?.elementId ? [otherBinding.elementId] : []
    
    const bindableElement = findBindableElement(point, canvasStore.visibleElements, excludeIds)
    
    if (bindableElement) {
      newBinding = createBinding(point, bindableElement)
      
      if (handle === 'start') {
        suggestedBindingStart.value = bindableElement
      } else {
        suggestedBindingEnd.value = bindableElement
      }
    } else {
      if (handle === 'start') {
        suggestedBindingStart.value = null
      } else {
        suggestedBindingEnd.value = null
      }
    }
  }

  if (snapEnabled) {
    targetX = canvasStore.snapValueToGrid(targetX)
    targetY = canvasStore.snapValueToGrid(targetY)
  }

  // Create new points array
  const newPoints = [...originalDims.points.map(p => ({ ...p }))]
  
  if (handle === 'start') {
    // Moving start point - adjust element position and first point
    const newX = targetX
    const newY = targetY
    
    // Update the relative positions of all points
    const deltaX = originalDims.x - newX
    const deltaY = originalDims.y - newY
    
    newPoints[0] = { x: 0, y: 0 }
    for (let i = 1; i < newPoints.length; i++) {
      newPoints[i] = {
        x: originalDims.points[i].x + deltaX,
        y: originalDims.points[i].y + deltaY,
      }
    }
    
    // Calculate new width/height
    const endX = newX + newPoints[newPoints.length - 1].x
    const endY = newY + newPoints[newPoints.length - 1].y
    
    // Store the pending binding for this endpoint
    pendingStartBinding.value = newBinding
    
    canvasStore.updateElement(element.id, {
      x: newX,
      y: newY,
      points: newPoints,
      width: Math.abs(endX - newX),
      height: Math.abs(endY - newY),
    })
  } else {
    // Moving end point - keep element position, update last point
    const lastIdx = newPoints.length - 1
    newPoints[lastIdx] = {
      x: targetX - originalDims.x,
      y: targetY - originalDims.y,
    }
    
    // Store the pending binding for this endpoint
    pendingEndBinding.value = newBinding
    
    canvasStore.updateElement(element.id, {
      points: newPoints,
      width: Math.abs(newPoints[lastIdx].x),
      height: Math.abs(newPoints[lastIdx].y),
    })
  }
}

function handleResize(point: Point) {
  if (!startPoint.value || !startElementBounds.value || !activeHandle.value) return

  const dx = point.x - startPoint.value.x
  const dy = point.y - startPoint.value.y
  const bounds = startElementBounds.value
  const snapEnabled = canvasStore.appState.snapToGrid && canvasStore.appState.gridSize

  let newX = bounds.x
  let newY = bounds.y
  let newWidth = bounds.width
  let newHeight = bounds.height

  // Handle line/arrow endpoint dragging
  if (activeHandle.value === 'start' || activeHandle.value === 'end') {
    handleLineEndpointDrag(point, activeHandle.value)
    return
  }

  switch (activeHandle.value) {
    case 'n':
      newY = bounds.y + dy
      newHeight = bounds.height - dy
      break
    case 's':
      newHeight = bounds.height + dy
      break
    case 'e':
      newWidth = bounds.width + dx
      break
    case 'w':
      newX = bounds.x + dx
      newWidth = bounds.width - dx
      break
    case 'nw':
      newX = bounds.x + dx
      newY = bounds.y + dy
      newWidth = bounds.width - dx
      newHeight = bounds.height - dy
      break
    case 'ne':
      newY = bounds.y + dy
      newWidth = bounds.width + dx
      newHeight = bounds.height - dy
      break
    case 'se':
      newWidth = bounds.width + dx
      newHeight = bounds.height + dy
      break
    case 'sw':
      newX = bounds.x + dx
      newWidth = bounds.width - dx
      newHeight = bounds.height + dy
      break
    case 'rotation':
      // Handle rotation
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      }
      let angle = Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2

      // Snap to 45 degree increments when shift is held
      if (isShiftPressed.value) {
        const snapAngle = Math.PI / 4 // 45 degrees in radians
        angle = Math.round(angle / snapAngle) * snapAngle
      }

      canvasStore.selectedElements.forEach(el => {
        canvasStore.updateElement(el.id, { angle })
      })
      return
  }

  // Constrain to square when shift is held (for corner handles only)
  if (isShiftPressed.value && ['nw', 'ne', 'se', 'sw'].includes(activeHandle.value)) {
    const maxDimension = Math.max(Math.abs(newWidth), Math.abs(newHeight))
    const widthSign = newWidth >= 0 ? 1 : -1
    const heightSign = newHeight >= 0 ? 1 : -1
    
    // Adjust position for handles that move the origin
    if (activeHandle.value === 'nw') {
      newX = bounds.x + bounds.width - widthSign * maxDimension
      newY = bounds.y + bounds.height - heightSign * maxDimension
    } else if (activeHandle.value === 'ne') {
      newY = bounds.y + bounds.height - heightSign * maxDimension
    } else if (activeHandle.value === 'sw') {
      newX = bounds.x + bounds.width - widthSign * maxDimension
    }
    
    newWidth = widthSign * maxDimension
    newHeight = heightSign * maxDimension
  }

  // Snap to grid if enabled
  if (snapEnabled) {
    newX = canvasStore.snapValueToGrid(newX)
    newY = canvasStore.snapValueToGrid(newY)
    newWidth = canvasStore.snapValueToGrid(newWidth)
    newHeight = canvasStore.snapValueToGrid(newHeight)
  }

  // Ensure minimum size
  newWidth = Math.max(newWidth, snapEnabled ? canvasStore.appState.gridSize! : 5)
  newHeight = Math.max(newHeight, snapEnabled ? canvasStore.appState.gridSize! : 5)

  // Calculate scale factor for font sizing
  const scaleY = newHeight / bounds.height

  // Calculate scale factors for point-based elements
  const scaleX = newWidth / bounds.width
  const scaleXAbs = Math.abs(scaleX)
  const scaleYAbs = Math.abs(scaleY)

  // Update each selected element using ORIGINAL dimensions
  canvasStore.selectedElementIds.forEach(id => {
    const originalDims = startElementDimensions.value.get(id)
    if (!originalDims) return
    
    const element = canvasStore.getElementById(id)
    if (!element) return

    // Calculate relative position/size based on ORIGINAL dimensions
    const relX = (originalDims.x - bounds.x) / bounds.width
    const relY = (originalDims.y - bounds.y) / bounds.height

    // Special handling for text elements - maintain aspect ratio
    if (element.type === 'text' && originalDims.fontSize && element.text) {
      const newFontSize = Math.max(8, Math.round(originalDims.fontSize * scaleYAbs))
      
      // Recalculate text dimensions with new font size
      const textDims = measureTextDimensions(element.text, newFontSize, element.fontFamily)
      
      canvasStore.updateElement(id, {
        x: newX + relX * newWidth,
        y: newY + relY * newHeight,
        width: textDims.width,
        height: textDims.height,
        fontSize: newFontSize,
      })
    } else if ((element.type === 'freedraw' || element.type === 'line' || element.type === 'arrow') && originalDims.points) {
      // Scale points for point-based elements
      const scaledPoints = originalDims.points.map(p => ({
        x: p.x * scaleXAbs,
        y: p.y * scaleYAbs,
      }))
      
      canvasStore.updateElement(id, {
        x: newX + relX * newWidth,
        y: newY + relY * newHeight,
        width: Math.abs(originalDims.width * scaleXAbs),
        height: Math.abs(originalDims.height * scaleYAbs),
        points: scaledPoints,
      })
    } else {
      // Normal resize for non-text, non-point-based elements
      const relWidth = originalDims.width / bounds.width
      const relHeight = originalDims.height / bounds.height

      canvasStore.updateElement(id, {
        x: newX + relX * newWidth,
        y: newY + relY * newHeight,
        width: Math.abs(relWidth * newWidth),
        height: Math.abs(relHeight * newHeight),
      })
    }
  })
}

function handleDraw(point: Point) {
  if (!drawingElement.value || !startPoint.value) return

  const tool = canvasStore.activeTool
  const snapEnabled = canvasStore.appState.snapToGrid && canvasStore.appState.gridSize

  if (tool === 'freedraw') {
    // Add point to freedraw (no snapping for freehand drawing)
    const relativePoint = {
      x: point.x - drawingElement.value.x,
      y: point.y - drawingElement.value.y,
    }
    drawingElement.value = {
      ...drawingElement.value,
      points: [...(drawingElement.value.points || []), relativePoint],
    }
  } else if (tool === 'line' || tool === 'arrow') {
    // Snap endpoint if enabled
    let endX = snapEnabled ? canvasStore.snapValueToGrid(point.x) : point.x
    let endY = snapEnabled ? canvasStore.snapValueToGrid(point.y) : point.y

    // Check for binding on end point for arrows (don't snap position, just create binding)
    if (tool === 'arrow') {
      const startElementId = pendingStartBinding.value?.elementId
      const excludeIds = startElementId ? [startElementId] : []
      const bindableElement = findBindableElement(point, canvasStore.visibleElements, excludeIds)
      
      if (bindableElement) {
        suggestedBindingEnd.value = bindableElement
        pendingEndBinding.value = createBinding(point, bindableElement)
      } else {
        suggestedBindingEnd.value = null
        pendingEndBinding.value = null
      }
    }

    const relativePoint = {
      x: endX - drawingElement.value.x,
      y: endY - drawingElement.value.y,
    }
    drawingElement.value = {
      ...drawingElement.value,
      points: [{ x: 0, y: 0 }, relativePoint],
      width: Math.abs(endX - drawingElement.value.x),
      height: Math.abs(endY - drawingElement.value.y),
    }
  } else {
    // Update shape dimensions with snapping
    let width = point.x - drawingElement.value.x
    let height = point.y - drawingElement.value.y

    if (snapEnabled) {
      width = canvasStore.snapValueToGrid(width)
      height = canvasStore.snapValueToGrid(height)
    }

    // Constrain to square when shift is held
    if (isShiftPressed.value) {
      const maxDimension = Math.max(Math.abs(width), Math.abs(height))
      width = Math.sign(width) * maxDimension || maxDimension
      height = Math.sign(height) * maxDimension || maxDimension
    }

    drawingElement.value = {
      ...drawingElement.value,
      width,
      height,
    }
  }
}

// Pointer up handler
function handlePointerUp(e: PointerEvent) {
  canvasRef.value?.releasePointerCapture(e.pointerId)

  if (isPanning.value) {
    isPanning.value = false
    cursorStyle.value = canvasStore.activeTool === 'hand' ? 'grab' : 'default'
  }

  if (isDragging.value) {
    isDragging.value = false
    canvasStore.saveToHistory()
    cursorStyle.value = 'default'
  }

  if (isResizing.value) {
    // Apply arrow bindings when endpoint drag is complete
    const selectedElements = canvasStore.selectedElements
    if (selectedElements.length === 1 && selectedElements[0].type === 'arrow') {
      const arrow = selectedElements[0]
      
      if (activeHandle.value === 'start') {
        // Update start binding
        const previousStartId = arrow.startBinding?.elementId
        canvasStore.setArrowBinding(arrow.id, 'start', pendingStartBinding.value, previousStartId)
      } else if (activeHandle.value === 'end') {
        // Update end binding
        const previousEndId = arrow.endBinding?.elementId
        canvasStore.setArrowBinding(arrow.id, 'end', pendingEndBinding.value, previousEndId)
      }
    }
    
    // Clear binding state
    suggestedBindingStart.value = null
    suggestedBindingEnd.value = null
    pendingStartBinding.value = null
    pendingEndBinding.value = null
    
    isResizing.value = false
    activeHandle.value = null
    startElementBounds.value = null
    startElementDimensions.value.clear()
    canvasStore.saveToHistory()
  }

  if (isSelecting.value && startPoint.value && currentPoint.value) {
    const x = Math.min(startPoint.value.x, currentPoint.value.x)
    const y = Math.min(startPoint.value.y, currentPoint.value.y)
    const width = Math.abs(currentPoint.value.x - startPoint.value.x)
    const height = Math.abs(currentPoint.value.y - startPoint.value.y)

    const elementsInBounds = getElementsInBounds(canvasStore.visibleElements, {
      x,
      y,
      width,
      height,
    })

    if (elementsInBounds.length > 0) {
      canvasStore.selectElements(elementsInBounds.map(el => el.id))
    }

    isSelecting.value = false
  }

  if (isDrawing.value && drawingElement.value) {
    // Normalize and add the element
    const normalized = normalizeElement(drawingElement.value)

    // Only add if it has some size
    if (
      normalized.width > 1 ||
      normalized.height > 1 ||
      (normalized.points && normalized.points.length > 1)
    ) {
      // Apply bindings for arrows
      if (normalized.type === 'arrow') {
        if (pendingStartBinding.value) {
          normalized.startBinding = pendingStartBinding.value
        }
        if (pendingEndBinding.value) {
          normalized.endBinding = pendingEndBinding.value
        }
      }

      canvasStore.addElement(normalized)
      canvasStore.selectElement(normalized.id)

      // Update bound elements references
      if (normalized.type === 'arrow') {
        if (pendingStartBinding.value) {
          canvasStore.addBoundElement(pendingStartBinding.value.elementId, normalized.id, 'arrow')
        }
        if (pendingEndBinding.value) {
          canvasStore.addBoundElement(pendingEndBinding.value.elementId, normalized.id, 'arrow')
        }
      }
    }

    // Clear binding state
    drawingElement.value = null
    suggestedBindingStart.value = null
    suggestedBindingEnd.value = null
    pendingStartBinding.value = null
    pendingEndBinding.value = null
    isDrawing.value = false

    // Switch to selection/pan tool after drawing (like Excalidraw)
    // On mobile, switch to pan tool for better touch experience
    if (canvasStore.activeTool !== 'freedraw') {
      canvasStore.setActiveTool(isMobile.value ? 'hand' : 'selection')
    }
  }

  isPointerDown.value = false
  isMobileSmartDrag.value = false
  startPoint.value = null
  startElementPositions.value = new Map()
}

// Mouse wheel for zoom
function handleWheel(e: WheelEvent) {
  e.preventDefault()

  // Always zoom with scroll wheel
  const rect = canvasRef.value!.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Calculate zoom delta
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const oldZoom = canvasStore.zoom
  const newZoom = Math.max(0.1, Math.min(10, oldZoom * delta))

  // Calculate the point under the cursor in canvas coordinates before zoom
  const { scrollX, scrollY } = canvasStore.appState
  const canvasX = (mouseX - scrollX) / oldZoom
  const canvasY = (mouseY - scrollY) / oldZoom

  // Set new zoom
  canvasStore.setZoom(newZoom)

  // Adjust scroll so the point under cursor stays in the same screen position
  const newScrollX = mouseX - canvasX * newZoom
  const newScrollY = mouseY - canvasY * newZoom
  canvasStore.setScroll(newScrollX, newScrollY)
}

// Keyboard handling
let spacePressed = false

function handleKeyDown(e: KeyboardEvent) {
  // Don't handle if typing in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return
  }

  // Space for panning
  if (e.code === 'Space' && !spacePressed) {
    spacePressed = true
    canvasStore.setActiveTool('hand')
    cursorStyle.value = 'grab'
    return
  }

  // Tool shortcuts
  if (!e.ctrlKey && !e.metaKey) {
    switch (e.key) {
      case '1':
      case 'v':
        canvasStore.setActiveTool('selection')
        break
      case '2':
      case 'r':
        canvasStore.setActiveTool('rectangle')
        break
      case '3':
      case 'o':
        canvasStore.setActiveTool('ellipse')
        break
      case '4':
      case 'd':
        canvasStore.setActiveTool('diamond')
        break
      case '5':
      case 'a':
        canvasStore.setActiveTool('arrow')
        break
      case '6':
      case 'l':
        canvasStore.setActiveTool('line')
        break
      case '7':
      case 'p':
        canvasStore.setActiveTool('freedraw')
        break
      case '8':
      case 't':
        canvasStore.setActiveTool('text')
        break
      case 'e':
        canvasStore.setActiveTool('eraser')
        break
      case 'h':
        canvasStore.setActiveTool('hand')
        break
      case 'Delete':
      case 'Backspace':
        canvasStore.deleteSelectedElements()
        break
      case 'Escape':
        canvasStore.clearSelection()
        canvasStore.setActiveTool('selection')
        break
    }
  }

  // Ctrl/Cmd shortcuts
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'z':
        if (e.shiftKey) {
          canvasStore.redo()
        } else {
          canvasStore.undo()
        }
        e.preventDefault()
        break
      case 'y':
        canvasStore.redo()
        e.preventDefault()
        break
      case 'a':
        canvasStore.selectAll()
        e.preventDefault()
        break
      case 'c':
        canvasStore.copySelectedElements()
        e.preventDefault()
        break
      case 'v':
        canvasStore.pasteElements()
        e.preventDefault()
        break
      case 'd':
        canvasStore.duplicateSelectedElements()
        e.preventDefault()
        break
      case 'g':
        canvasStore.toggleGrid()
        e.preventDefault()
        break
      case '0':
        canvasStore.resetZoom()
        e.preventDefault()
        break
      case '=':
      case '+':
        canvasStore.zoomIn()
        e.preventDefault()
        break
      case '-':
        canvasStore.zoomOut()
        e.preventDefault()
        break
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spacePressed = false
    canvasStore.setActiveTool('selection')
    cursorStyle.value = 'default'
  }
}

// Double click to edit text elements
function handleDoubleClick(e: MouseEvent) {
  const point = getCanvasPoint(e)
  const element = getElementAtPoint(canvasStore.visibleElements, point)

  if (element && element.type === 'text') {
    // Edit existing text element
    editingTextElement.value = { ...element }
    isEditingText.value = true
    canvasStore.selectElement(element.id)
  }
}

</script>

<template>
  <div
    ref="containerRef"
    class="absolute inset-0 overflow-hidden"
    :style="{ cursor: cursorStyle }"
  >
    <canvas
      ref="canvasRef"
      class="touch-none"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerUp"
      @wheel="handleWheel"
      @dblclick="handleDoubleClick"
      @contextmenu.prevent
    />

    <!-- Text editing overlay -->
    <TextInput
      v-if="isEditingText && editingTextElement"
      :element="editingTextElement"
      :zoom="canvasStore.zoom"
      :scrollX="canvasStore.appState.scrollX"
      :scrollY="canvasStore.appState.scrollY"
      @complete="handleTextComplete"
      @cancel="handleTextCancel"
    />

    <!-- Empty canvas hints -->
    <EmptyCanvasHints />
  </div>
</template>

