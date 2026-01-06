// canvara (Excalidraw Clone) - Shared Types

export interface Point {
  x: number
  y: number
}

export type ElementType = 
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'image'

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'none'
export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'
export type FontFamily = 'virgil' | 'normal' | 'code'
export type ArrowHead = 'none' | 'arrow' | 'bar' | 'dot' | 'triangle'

export interface ExcalidrawElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  angle: number
  strokeColor: string
  backgroundColor: string
  fillStyle: FillStyle
  strokeWidth: number
  strokeStyle: StrokeStyle
  roughness: number
  opacity: number
  seed: number
  groupIds: string[]
  isDeleted: boolean
  version: number
  versionNonce: number
  
  // Binding
  boundElements: Array<{ id: string; type: 'arrow' | 'text' }> | null
  
  // For lines, arrows, freedraw
  points?: Point[]
  lastCommittedPoint?: Point | null
  startBinding?: PointBinding | null
  endBinding?: PointBinding | null
  startArrowhead?: ArrowHead | null
  endArrowhead?: ArrowHead | null
  
  // For text
  text?: string
  fontSize?: number
  fontFamily?: FontFamily
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
  containerId?: string | null
  originalText?: string
  lineHeight?: number
  
  // For images
  fileId?: string | null
  status?: 'pending' | 'saved' | 'error'
  scale?: [number, number]
  
  // Rounding
  roundness?: { type: number; value?: number } | null
  
  // Lock
  locked?: boolean
  
  // Link
  link?: string | null
  
  // Frame (for grouping/framing)
  frameId?: string | null
}

export interface PointBinding {
  elementId: string
  focus: number
  gap: number
}

// Collaboration types
export interface Collaborator {
  userId: string
  username: string
  color: string
  cursor: Point | null
  selectedElementIds: string[]
  isCurrentUser?: boolean
}

export interface Room {
  id: string
  elements: ExcalidrawElement[]
  collaborators: Map<string, Collaborator>
  createdAt: number
  updatedAt: number
}

// WebSocket message types
export type WSMessageType = 
  | 'join'
  | 'leave'
  | 'sync'
  | 'update'
  | 'cursor'
  | 'selection'
  | 'user-joined'
  | 'user-left'
  | 'error'

export interface WSMessage {
  type: WSMessageType
  roomId: string
  userId: string
  payload: unknown
}

export interface JoinPayload {
  username: string
}

export interface SyncPayload {
  elements: ExcalidrawElement[]
  collaborators: Collaborator[]
}

export interface UpdatePayload {
  elements: ExcalidrawElement[]
}

export interface CursorPayload {
  cursor: Point | null
}

export interface SelectionPayload {
  selectedElementIds: string[]
}

// Canvas state
export interface AppState {
  viewBackgroundColor: string
  zoom: { value: number }
  scrollX: number
  scrollY: number
  currentItemStrokeColor: string
  currentItemBackgroundColor: string
  currentItemFillStyle: FillStyle
  currentItemStrokeWidth: number
  currentItemStrokeStyle: StrokeStyle
  currentItemRoughness: number
  currentItemOpacity: number
  currentItemFontFamily: FontFamily
  currentItemFontSize: number
  currentItemTextAlign: TextAlign
  currentItemStartArrowhead: ArrowHead | null
  currentItemEndArrowhead: ArrowHead | null
  currentItemRoundness: 'sharp' | 'round'
  gridSize: number | null
  showGrid: boolean
  snapToGrid: boolean
}

// Tools
export type Tool = 
  | 'selection'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'eraser'
  | 'hand'

// History
export interface HistoryEntry {
  elements: ExcalidrawElement[]
  appState: Partial<AppState>
}

// Library
export interface LibraryItem {
  id: string
  status: 'published' | 'unpublished'
  elements: ExcalidrawElement[]
  createdAt: number
}

export interface Library {
  libraryItems: LibraryItem[]
}

// Export options
export interface ExportOptions {
  type: 'png' | 'svg' | 'json' | 'clipboard'
  withBackground: boolean
  scale: number
  onlySelected: boolean
  embedScene: boolean
}

// Bounding box for selection
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  angle: number
}

// Transform handle positions
export type TransformHandle = 
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'
  | 'rotation'
  | 'start' | 'end'  // For line/arrow endpoints

// ============================================
// Project Management Types
// ============================================

// Folder for organizing projects
export interface Folder {
  id: string
  name: string
  color: string
  sortOrder: number
  projectCount: number
  createdAt: number
  updatedAt: number
}

// Tag for labeling projects (colored labels)
export interface Tag {
  id: string
  name: string
  color: string  // hex color
  projectCount?: number
  createdAt: number
}

// Project list item (lightweight version for lists)
export interface ProjectListItem {
  id: string
  name: string
  thumbnail: string | null
  isDarkTheme: boolean
  folderId: string | null
  isStarred: boolean
  isArchived: boolean
  isTrashed: boolean
  trashedAt: number | null
  tags: Tag[]
  createdAt: number
  updatedAt: number
}

// Full project data
export interface Project extends ProjectListItem {
  elements: ExcalidrawElement[]
  appState: AppState | null
}

// Project sort options
export type ProjectSortField = 'name' | 'createdAt' | 'updatedAt'

// Project view types
export type ProjectView = 'all' | 'recent' | 'starred' | 'archived' | 'trashed' | 'folder'

// View mode for project list
export type ViewMode = 'grid' | 'list'

// Tag color palette
export const TAG_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
] as const

// Folder color palette (same as tags for consistency)
export const FOLDER_COLORS = TAG_COLORS

