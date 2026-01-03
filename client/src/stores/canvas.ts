import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { 
  ExcalidrawElement, 
  Tool, 
  AppState, 
  FillStyle, 
  StrokeStyle, 
  FontFamily,
  ArrowHead,
  PointBinding
} from '../types'
import { updateArrowBinding } from '../engine/binding'

const DEFAULT_APP_STATE: AppState = {
  viewBackgroundColor: '#ffffff',
  zoom: { value: 1 },
  scrollX: 0,
  scrollY: 0,
  currentItemStrokeColor: '#1e1e1e',
  currentItemBackgroundColor: 'transparent',
  currentItemFillStyle: 'hachure',
  currentItemStrokeWidth: 2,
  currentItemStrokeStyle: 'solid',
  currentItemRoughness: 1,
  currentItemOpacity: 100,
  currentItemFontFamily: 'virgil',
  currentItemFontSize: 20,
  currentItemTextAlign: 'left',
  currentItemStartArrowhead: null,
  currentItemEndArrowhead: 'arrow',
  currentItemRoundness: 'round',
  gridSize: 20,
  showGrid: false,
  snapToGrid: false,
}

export const useCanvasStore = defineStore('canvas', () => {
  // Elements - use ref instead of shallowRef for proper reactivity with collaboration
  const elements = ref<ExcalidrawElement[]>([])
  
  // Flag to track if we're receiving remote updates (to avoid re-broadcasting)
  const isReceivingRemoteUpdate = ref(false)
  
  // Selection
  const selectedElementIds = ref<Set<string>>(new Set())
  
  // Current tool
  const activeTool = ref<Tool>('selection')
  
  // App state (styling, zoom, etc.)
  const appState = ref<AppState>({ ...DEFAULT_APP_STATE })
  
  // History for undo/redo
  const history = ref<ExcalidrawElement[][]>([])
  const historyIndex = ref(-1)
  const maxHistoryLength = 100

  // Computed
  const selectedElements = computed(() => {
    return elements.value.filter(el => selectedElementIds.value.has(el.id) && !el.isDeleted)
  })

  const visibleElements = computed(() => {
    return elements.value.filter(el => !el.isDeleted)
  })

  const zoom = computed(() => appState.value.zoom.value)

  // Element creation
  function createElement(
    type: ExcalidrawElement['type'],
    x: number,
    y: number,
    options: Partial<ExcalidrawElement> = {}
  ): ExcalidrawElement {
    const element: ExcalidrawElement = {
      id: nanoid(),
      type,
      x,
      y,
      width: 0,
      height: 0,
      angle: 0,
      strokeColor: appState.value.currentItemStrokeColor,
      backgroundColor: appState.value.currentItemBackgroundColor,
      fillStyle: appState.value.currentItemFillStyle,
      strokeWidth: appState.value.currentItemStrokeWidth,
      strokeStyle: appState.value.currentItemStrokeStyle,
      roughness: appState.value.currentItemRoughness,
      opacity: appState.value.currentItemOpacity,
      seed: Math.floor(Math.random() * 2000000000),
      groupIds: [],
      isDeleted: false,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
      boundElements: null,
      roundness: appState.value.currentItemRoundness === 'round' 
        ? { type: 3 } 
        : null,
      ...options,
    }

    // Set default properties based on type
    if (type === 'text') {
      element.fontSize = appState.value.currentItemFontSize
      element.fontFamily = appState.value.currentItemFontFamily
      element.textAlign = appState.value.currentItemTextAlign
      element.verticalAlign = 'top'
      element.text = ''
      element.originalText = ''
      element.lineHeight = 1.25
    }

    if (type === 'arrow') {
      element.points = [{ x: 0, y: 0 }]
      element.startArrowhead = appState.value.currentItemStartArrowhead
      element.endArrowhead = appState.value.currentItemEndArrowhead
    }

    if (type === 'line') {
      element.points = [{ x: 0, y: 0 }]
    }

    if (type === 'freedraw') {
      element.points = []
    }

    return element
  }

  // Add element
  function addElement(element: ExcalidrawElement) {
    elements.value = [...elements.value, element]
    saveToHistory()
  }

  // Update element
  function updateElement(id: string, updates: Partial<ExcalidrawElement>) {
    elements.value = elements.value.map(el => {
      if (el.id === id) {
        return {
          ...el,
          ...updates,
          version: el.version + 1,
          versionNonce: Math.floor(Math.random() * 2000000000),
        }
      }
      return el
    })
  }

  // Update multiple elements (for batch operations)
  function updateElements(updates: Map<string, Partial<ExcalidrawElement>>) {
    elements.value = elements.value.map(el => {
      const update = updates.get(el.id)
      if (update) {
        return {
          ...el,
          ...update,
          version: el.version + 1,
          versionNonce: Math.floor(Math.random() * 2000000000),
        }
      }
      return el
    })
    saveToHistory()
  }

  // Update multiple elements in real-time (no history save, for drag operations)
  // This properly triggers reactivity for collaboration sync
  function updateElementsRealtime(updates: Map<string, Partial<ExcalidrawElement>>) {
    elements.value = elements.value.map(el => {
      const update = updates.get(el.id)
      if (update) {
        return {
          ...el,
          ...update,
          version: el.version + 1,
          versionNonce: Math.floor(Math.random() * 2000000000),
        }
      }
      return el
    })
  }

  // Delete elements
  function deleteElements(ids: string[]) {
    const idSet = new Set(ids)
    elements.value = elements.value.map(el => {
      if (idSet.has(el.id)) {
        return { ...el, isDeleted: true, version: el.version + 1 }
      }
      return el
    })
    selectedElementIds.value = new Set()
    saveToHistory()
  }

  // Delete selected elements
  function deleteSelectedElements() {
    deleteElements([...selectedElementIds.value])
  }

  // Selection
  function selectElement(id: string, addToSelection = false) {
    if (addToSelection) {
      selectedElementIds.value = new Set([...selectedElementIds.value, id])
    } else {
      selectedElementIds.value = new Set([id])
    }
  }

  function selectElements(ids: string[]) {
    selectedElementIds.value = new Set(ids)
  }

  function selectAll() {
    selectedElementIds.value = new Set(
      elements.value.filter(el => !el.isDeleted).map(el => el.id)
    )
  }

  function clearSelection() {
    selectedElementIds.value = new Set()
  }

  function isSelected(id: string): boolean {
    return selectedElementIds.value.has(id)
  }

  // Tool
  function setActiveTool(tool: Tool) {
    activeTool.value = tool
    if (tool !== 'selection') {
      clearSelection()
    }
  }

  // Zoom and pan
  function setZoom(value: number) {
    appState.value.zoom.value = Math.max(0.1, Math.min(10, value))
    debouncedSave()
  }

  function zoomIn() {
    setZoom(appState.value.zoom.value * 1.1)
  }

  function zoomOut() {
    setZoom(appState.value.zoom.value / 1.1)
  }

  function resetZoom() {
    setZoom(1)
    appState.value.scrollX = 0
    appState.value.scrollY = 0
    debouncedSave()
  }

  function setScroll(x: number, y: number) {
    appState.value.scrollX = x
    appState.value.scrollY = y
    debouncedSave()
  }

  function pan(deltaX: number, deltaY: number) {
    appState.value.scrollX += deltaX
    appState.value.scrollY += deltaY
    debouncedSave()
  }

  // Center the viewport on a specific point (in canvas coordinates)
  function centerOnPoint(canvasX: number, canvasY: number, viewportWidth: number, viewportHeight: number) {
    const zoom = appState.value.zoom.value
    // Calculate scroll so that the canvas point appears at the center of the viewport
    appState.value.scrollX = viewportWidth / 2 - canvasX * zoom
    appState.value.scrollY = viewportHeight / 2 - canvasY * zoom
    debouncedSave()
  }

  // Center the viewport on all visible content
  function centerOnContent(viewportWidth: number, viewportHeight: number) {
    const visible = visibleElements.value
    if (visible.length === 0) return false

    // Calculate bounding box of all visible elements
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    visible.forEach(el => {
      // Handle line-based elements with points
      if ((el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') && el.points) {
        el.points.forEach(p => {
          const px = el.x + p.x
          const py = el.y + p.y
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
        })
      } else {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + el.width)
        maxY = Math.max(maxY, el.y + el.height)
      }
    })

    if (!isFinite(minX) || !isFinite(minY)) return false

    // Calculate the center of the content
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2

    centerOnPoint(contentCenterX, contentCenterY, viewportWidth, viewportHeight)
    return true
  }

  // Styling setters
  function setStrokeColor(color: string) {
    appState.value.currentItemStrokeColor = color
    updateSelectedElementsStyle({ strokeColor: color })
  }

  function setBackgroundColor(color: string) {
    appState.value.currentItemBackgroundColor = color
    updateSelectedElementsStyle({ backgroundColor: color })
  }

  function setFillStyle(style: FillStyle) {
    appState.value.currentItemFillStyle = style
    updateSelectedElementsStyle({ fillStyle: style })
  }

  function setStrokeWidth(width: number) {
    appState.value.currentItemStrokeWidth = width
    updateSelectedElementsStyle({ strokeWidth: width })
  }

  function setStrokeStyle(style: StrokeStyle) {
    appState.value.currentItemStrokeStyle = style
    updateSelectedElementsStyle({ strokeStyle: style })
  }

  function setRoughness(roughness: number) {
    appState.value.currentItemRoughness = roughness
    updateSelectedElementsStyle({ roughness })
  }

  function setOpacity(opacity: number) {
    appState.value.currentItemOpacity = opacity
    updateSelectedElementsStyle({ opacity })
  }

  function setFontSize(size: number) {
    appState.value.currentItemFontSize = size
    updateSelectedElementsStyle({ fontSize: size })
  }

  function setFontFamily(family: FontFamily) {
    appState.value.currentItemFontFamily = family
    updateSelectedElementsStyle({ fontFamily: family })
  }

  function setStartArrowhead(arrowhead: ArrowHead | null) {
    appState.value.currentItemStartArrowhead = arrowhead
    // Update selected arrow elements
    selectedElements.value
      .filter(el => el.type === 'arrow')
      .forEach(el => {
        updateElement(el.id, { startArrowhead: arrowhead })
      })
  }

  function setEndArrowhead(arrowhead: ArrowHead | null) {
    appState.value.currentItemEndArrowhead = arrowhead
    // Update selected arrow elements
    selectedElements.value
      .filter(el => el.type === 'arrow')
      .forEach(el => {
        updateElement(el.id, { endArrowhead: arrowhead })
      })
  }

  function updateSelectedElementsStyle(updates: Partial<ExcalidrawElement>) {
    if (selectedElementIds.value.size === 0) return
    
    const updateMap = new Map<string, Partial<ExcalidrawElement>>()
    selectedElementIds.value.forEach(id => {
      updateMap.set(id, updates)
    })
    updateElements(updateMap)
  }

  // Z-index operations
  function bringToFront(ids: string[]) {
    const idSet = new Set(ids)
    const toMove = elements.value.filter(el => idSet.has(el.id))
    const rest = elements.value.filter(el => !idSet.has(el.id))
    elements.value = [...rest, ...toMove]
    saveToHistory()
  }

  function sendToBack(ids: string[]) {
    const idSet = new Set(ids)
    const toMove = elements.value.filter(el => idSet.has(el.id))
    const rest = elements.value.filter(el => !idSet.has(el.id))
    elements.value = [...toMove, ...rest]
    saveToHistory()
  }

  function bringForward(ids: string[]) {
    const newElements = [...elements.value]
    ids.forEach(id => {
      const index = newElements.findIndex(el => el.id === id)
      if (index < newElements.length - 1) {
        const temp = newElements[index]
        newElements[index] = newElements[index + 1]
        newElements[index + 1] = temp
      }
    })
    elements.value = newElements
    saveToHistory()
  }

  function sendBackward(ids: string[]) {
    const newElements = [...elements.value]
    ids.forEach(id => {
      const index = newElements.findIndex(el => el.id === id)
      if (index > 0) {
        const temp = newElements[index]
        newElements[index] = newElements[index - 1]
        newElements[index - 1] = temp
      }
    })
    elements.value = newElements
    saveToHistory()
  }

  // Auto-save to localStorage with debouncing
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      saveToLocalStorage()
    }, 500) // 500ms debounce to avoid excessive writes
  }

  // History (undo/redo)
  function saveToHistory() {
    // Remove any future history if we're not at the end
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1)
    }
    
    // Add current state
    history.value.push(JSON.parse(JSON.stringify(elements.value)))
    
    // Limit history length
    if (history.value.length > maxHistoryLength) {
      history.value = history.value.slice(-maxHistoryLength)
    }
    
    historyIndex.value = history.value.length - 1
    
    // Auto-save after history is updated
    debouncedSave()
  }

  function undo() {
    if (historyIndex.value > 0) {
      historyIndex.value--
      elements.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
      clearSelection()
      debouncedSave()
    }
  }

  function redo() {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      elements.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
      clearSelection()
      debouncedSave()
    }
  }

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // Copy/Paste
  let clipboard: ExcalidrawElement[] = []

  function copySelectedElements() {
    clipboard = JSON.parse(JSON.stringify(selectedElements.value))
  }

  function pasteElements(offsetX = 10, offsetY = 10) {
    if (clipboard.length === 0) return

    const newElements = clipboard.map(el => ({
      ...el,
      id: nanoid(),
      x: el.x + offsetX,
      y: el.y + offsetY,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
    }))

    elements.value = [...elements.value, ...newElements]
    selectedElementIds.value = new Set(newElements.map(el => el.id))
    saveToHistory()
  }

  function duplicateSelectedElements() {
    copySelectedElements()
    pasteElements(20, 20)
  }

  // Grid
  function toggleGrid() {
    appState.value.showGrid = !appState.value.showGrid
    // When grid is shown, enable snap-to-grid by default
    appState.value.snapToGrid = appState.value.showGrid
  }

  function toggleSnapToGrid() {
    appState.value.snapToGrid = !appState.value.snapToGrid
  }

  function setGridSize(size: number | null) {
    appState.value.gridSize = size
  }

  // Snap a value to the grid
  function snapValueToGrid(value: number): number {
    if (!appState.value.snapToGrid || !appState.value.gridSize) {
      return value
    }
    return Math.round(value / appState.value.gridSize) * appState.value.gridSize
  }

  // Snap a point to the grid
  function snapPointToGrid(x: number, y: number): { x: number; y: number } {
    return {
      x: snapValueToGrid(x),
      y: snapValueToGrid(y),
    }
  }

  // Persistence
  function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('canvara-canvas')
      if (saved) {
        const data = JSON.parse(saved)
        elements.value = data.elements || []
        if (data.appState) {
          appState.value = { ...DEFAULT_APP_STATE, ...data.appState }
        }
        saveToHistory()
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e)
    }
  }

  function saveToLocalStorage() {
    try {
      const data = {
        elements: elements.value,
        appState: appState.value,
      }
      localStorage.setItem('canvara-canvas', JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save to localStorage:', e)
    }
  }

  function clearCanvas() {
    elements.value = []
    selectedElementIds.value = new Set()
    saveToHistory()
    saveToLocalStorage()
  }

  // Set elements from external source (collaboration)
  function setElements(newElements: ExcalidrawElement[]) {
    isReceivingRemoteUpdate.value = true
    elements.value = newElements
    // Reset flag after Vue's next tick to ensure watcher sees it
    setTimeout(() => {
      isReceivingRemoteUpdate.value = false
    }, 0)
  }

  // Merge elements from collaboration
  function mergeElements(remoteElements: ExcalidrawElement[]) {
    isReceivingRemoteUpdate.value = true
    
    const elementMap = new Map(elements.value.map(el => [el.id, el]))
    let updatedCount = 0
    
    remoteElements.forEach(remoteEl => {
      const localEl = elementMap.get(remoteEl.id)
      if (!localEl || remoteEl.version > localEl.version) {
        elementMap.set(remoteEl.id, remoteEl)
        updatedCount++
      }
    })
    
    elements.value = Array.from(elementMap.values())
    
    // Reset flag after Vue's next tick to ensure watcher sees it
    setTimeout(() => {
      isReceivingRemoteUpdate.value = false
    }, 0)
  }

  // Get element by id
  function getElementById(id: string): ExcalidrawElement | undefined {
    return elements.value.find(el => el.id === id)
  }

  // Add a bound element reference to an element
  function addBoundElement(elementId: string, boundId: string, type: 'arrow' | 'text') {
    const element = getElementById(elementId)
    if (!element) return

    const boundElements = element.boundElements || []
    // Check if already bound
    if (boundElements.some(b => b.id === boundId)) return

    updateElement(elementId, {
      boundElements: [...boundElements, { id: boundId, type }]
    })
  }

  // Remove a bound element reference from an element
  function removeBoundElement(elementId: string, boundId: string) {
    const element = getElementById(elementId)
    if (!element || !element.boundElements) return

    updateElement(elementId, {
      boundElements: element.boundElements.filter(b => b.id !== boundId)
    })
  }

  // Update all arrows bound to moved elements
  function updateBoundArrows(movedElementIds: string[]) {
    const movedIdSet = new Set(movedElementIds)
    const arrowsToUpdate: ExcalidrawElement[] = []

    // Find all arrows that are bound to the moved elements
    elements.value.forEach(el => {
      if (el.type === 'arrow' && !el.isDeleted) {
        const startBoundTo = el.startBinding?.elementId
        const endBoundTo = el.endBinding?.elementId
        
        if ((startBoundTo && movedIdSet.has(startBoundTo)) ||
            (endBoundTo && movedIdSet.has(endBoundTo))) {
          arrowsToUpdate.push(el)
        }
      }
    })

    // Update each arrow's points based on bindings
    arrowsToUpdate.forEach(arrow => {
      const update = updateArrowBinding(arrow, elements.value)
      if (update) {
        updateElement(arrow.id, update)
      }
    })
  }

  // Set arrow bindings
  function setArrowBinding(
    arrowId: string,
    endpoint: 'start' | 'end',
    binding: PointBinding | null,
    previousElementId?: string
  ) {
    // Remove from previous element if exists
    if (previousElementId) {
      removeBoundElement(previousElementId, arrowId)
    }

    // Update arrow binding
    const updateKey = endpoint === 'start' ? 'startBinding' : 'endBinding'
    updateElement(arrowId, { [updateKey]: binding })

    // Add to new element if binding exists
    if (binding) {
      addBoundElement(binding.elementId, arrowId, 'arrow')
    }
  }

  // Color inversion map for theme switching
  const colorInversionMap: Record<string, string> = {
    '#1e1e1e': '#ffffff',
    '#ffffff': '#1e1e1e',
    '#000000': '#ffffff',
    '#fff': '#1e1e1e',
    '#000': '#ffffff',
    'black': '#ffffff',
    'white': '#1e1e1e',
  }

  // Invert a single color
  function invertColor(color: string): string {
    const lowerColor = color.toLowerCase()
    if (colorInversionMap[lowerColor]) {
      return colorInversionMap[lowerColor]
    }
    // For other colors, keep them as is
    return color
  }

  // Invert colors for all elements when switching theme
  function invertElementColors() {
    elements.value = elements.value.map(el => ({
      ...el,
      strokeColor: invertColor(el.strokeColor),
      backgroundColor: el.backgroundColor === 'transparent' 
        ? 'transparent' 
        : invertColor(el.backgroundColor),
      version: el.version + 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
    }))

    // Also invert the current styling defaults
    appState.value.currentItemStrokeColor = invertColor(appState.value.currentItemStrokeColor)
    if (appState.value.currentItemBackgroundColor !== 'transparent') {
      appState.value.currentItemBackgroundColor = invertColor(appState.value.currentItemBackgroundColor)
    }

    // Invert canvas background
    appState.value.viewBackgroundColor = invertColor(appState.value.viewBackgroundColor)

    saveToHistory()
    saveToLocalStorage()
  }

  // Set dark/light mode and invert colors
  function setThemeMode(isDark: boolean) {
    // Set appropriate background
    appState.value.viewBackgroundColor = isDark ? '#121212' : '#ffffff'
  }

  return {
    // State
    elements,
    selectedElementIds,
    activeTool,
    appState,
    isReceivingRemoteUpdate,
    
    // Computed
    selectedElements,
    visibleElements,
    zoom,
    canUndo,
    canRedo,
    
    // Element operations
    createElement,
    addElement,
    updateElement,
    updateElements,
    updateElementsRealtime,
    deleteElements,
    deleteSelectedElements,
    getElementById,
    
    // Selection
    selectElement,
    selectElements,
    selectAll,
    clearSelection,
    isSelected,
    
    // Tools
    setActiveTool,
    
    // Zoom and pan
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setScroll,
    pan,
    centerOnPoint,
    centerOnContent,
    
    // Styling
    setStrokeColor,
    setBackgroundColor,
    setFillStyle,
    setStrokeWidth,
    setStrokeStyle,
    setRoughness,
    setOpacity,
    setFontSize,
    setFontFamily,
    setStartArrowhead,
    setEndArrowhead,
    
    // Z-index
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    
    // History
    saveToHistory,
    undo,
    redo,
    
    // Copy/Paste
    copySelectedElements,
    pasteElements,
    duplicateSelectedElements,
    
    // Grid
    toggleGrid,
    toggleSnapToGrid,
    setGridSize,
    snapValueToGrid,
    snapPointToGrid,
    
    // Persistence
    loadFromLocalStorage,
    saveToLocalStorage,
    clearCanvas,
    
    // Collaboration
    setElements,
    mergeElements,

    // Theme
    invertElementColors,
    setThemeMode,

    // Bindings
    addBoundElement,
    removeBoundElement,
    updateBoundArrows,
    setArrowBinding,
  }
})

