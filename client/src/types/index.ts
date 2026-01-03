// Re-export shared types
export * from '../../../shared/types'

// Client-specific types
export interface PointerState {
  x: number
  y: number
  isDown: boolean
  button: number
  origin: { x: number; y: number } | null
  lastClick: { x: number; y: number; time: number } | null
}

export interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  elementStartPositions: Map<string, { x: number; y: number }>
}

export interface ResizeState {
  isResizing: boolean
  handle: import('../../../shared/types').TransformHandle | null
  startBounds: import('../../../shared/types').BoundingBox | null
}

export interface CanvasState {
  width: number
  height: number
  dpr: number
}

// Keyboard modifiers
export interface Modifiers {
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

