import type { Point, ExcalidrawElement, BoundingBox } from '../types'

// Convert screen coordinates to canvas coordinates
export function screenToCanvas(
  screenX: number,
  screenY: number,
  scrollX: number,
  scrollY: number,
  zoom: number
): Point {
  return {
    x: (screenX - scrollX) / zoom,
    y: (screenY - scrollY) / zoom,
  }
}

// Convert canvas coordinates to screen coordinates
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  scrollY: number,
  zoom: number
): Point {
  return {
    x: canvasX * zoom + scrollX,
    y: canvasY * zoom + scrollY,
  }
}

// Calculate distance between two points
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

// Calculate angle between two points
export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}

// Rotate a point around an origin
export function rotatePoint(point: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

// Get element bounding box (accounting for rotation)
export function getElementBounds(element: ExcalidrawElement): BoundingBox {
  let minX = element.x
  let minY = element.y
  let maxX = element.x + element.width
  let maxY = element.y + element.height

  if (element.type === 'line' || element.type === 'arrow' || element.type === 'freedraw') {
    if (element.points && element.points.length > 0) {
      const points = element.points.map(p => ({
        x: element.x + p.x,
        y: element.y + p.y,
      }))
      minX = Math.min(...points.map(p => p.x))
      minY = Math.min(...points.map(p => p.y))
      maxX = Math.max(...points.map(p => p.x))
      maxY = Math.max(...points.map(p => p.y))
    }
  }

  // Account for stroke width
  const strokePadding = element.strokeWidth / 2
  minX -= strokePadding
  minY -= strokePadding
  maxX += strokePadding
  maxY += strokePadding

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    angle: element.angle,
  }
}

// Get bounding box for multiple elements
export function getCommonBounds(elements: ExcalidrawElement[]): BoundingBox | null {
  if (elements.length === 0) return null

  // For single element, return its direct bounds to preserve rotation info
  // But for freedraw, line, and arrow elements, calculate bounds from points
  if (elements.length === 1) {
    const el = elements[0]
    
    // For elements with points, calculate actual bounds from points
    if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') {
      const bounds = getElementBounds(el)
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        angle: el.angle || 0,
      }
    }
    
    return {
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle || 0,
    }
  }

  // For multiple elements, compute axis-aligned bounding box
  const bounds = elements.map(getElementBounds)
  
  const minX = Math.min(...bounds.map(b => b.x))
  const minY = Math.min(...bounds.map(b => b.y))
  const maxX = Math.max(...bounds.map(b => b.x + b.width))
  const maxY = Math.max(...bounds.map(b => b.y + b.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    angle: 0,
  }
}

// Check if a point is inside a rectangle
export function isPointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

// Check if a point is inside an ellipse
export function isPointInEllipse(
  point: Point,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): boolean {
  const dx = point.x - cx
  const dy = point.y - cy
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
}

// Check if a point is inside a diamond
export function isPointInDiamond(
  point: Point,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const cx = x + width / 2
  const cy = y + height / 2
  const dx = Math.abs(point.x - cx)
  const dy = Math.abs(point.y - cy)
  return dx / (width / 2) + dy / (height / 2) <= 1
}

// Check if a point is near a line segment
export function isPointNearLine(
  point: Point,
  p1: Point,
  p2: Point,
  threshold: number
): boolean {
  const length = distance(p1, p2)
  if (length === 0) return distance(point, p1) <= threshold

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) /
        (length * length)
    )
  )

  const projection = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  }

  return distance(point, projection) <= threshold
}

// Check if a point is near a polyline (for freedraw, lines, arrows)
export function isPointNearPolyline(
  point: Point,
  points: Point[],
  threshold: number
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (isPointNearLine(point, points[i], points[i + 1], threshold)) {
      return true
    }
  }
  return false
}

// Normalize element dimensions (handle negative width/height)
export function normalizeElement(element: ExcalidrawElement): ExcalidrawElement {
  let { x, y, width, height } = element
  
  if (width < 0) {
    x += width
    width = Math.abs(width)
  }
  
  if (height < 0) {
    y += height
    height = Math.abs(height)
  }
  
  return { ...element, x, y, width, height }
}

// Snap to grid
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

// Snap point to grid
export function snapPointToGrid(point: Point, gridSize: number): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  }
}

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Generate control points for smooth curves (Catmull-Rom to Bezier)
export function getCurvePathData(points: Point[], closed = false): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? (closed ? points.length - 1 : 0) : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 !== undefined ? i + 2 : (closed ? 0 : i + 1)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  if (closed) {
    path += ' Z'
  }

  return path
}

// Simplify path (Douglas-Peucker algorithm)
export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  // Find the point with the maximum distance
  let maxDistance = 0
  let maxIndex = 0

  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end)
    if (d > maxDistance) {
      maxDistance = d
      maxIndex = i
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [start, end]
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y

  const length = Math.sqrt(dx * dx + dy * dy)
  if (length === 0) return distance(point, lineStart)

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (length * length)
  
  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2)
}

