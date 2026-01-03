import type { ExcalidrawElement, Point, TransformHandle } from '../types'
import {
  isPointInRect,
  isPointInEllipse,
  isPointInDiamond,
  isPointNearPolyline,
  getElementBounds,
  rotatePoint,
} from './math'

const HIT_THRESHOLD = 10

// Test if a point hits an element
export function hitTestElement(
  element: ExcalidrawElement,
  point: Point,
  threshold = HIT_THRESHOLD
): boolean {
  if (element.isDeleted) return false

  // Account for element rotation
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }
  const rotatedPoint = element.angle
    ? rotatePoint(point, center, -element.angle)
    : point

  switch (element.type) {
    case 'rectangle':
      return hitTestRectangle(element, rotatedPoint, threshold)
    case 'ellipse':
      return hitTestEllipse(element, rotatedPoint, threshold)
    case 'diamond':
      return hitTestDiamond(element, rotatedPoint, threshold)
    case 'line':
    case 'arrow':
      return hitTestLine(element, rotatedPoint, threshold)
    case 'freedraw':
      return hitTestFreedraw(element, rotatedPoint, threshold)
    case 'text':
      return hitTestText(element, rotatedPoint)
    case 'image':
      return hitTestImage(element, rotatedPoint)
    default:
      return false
  }
}

function hitTestRectangle(
  element: ExcalidrawElement,
  point: Point,
  threshold: number
): boolean {
  const { x, y, width, height, backgroundColor } = element
  const filled = backgroundColor !== 'transparent'

  if (filled) {
    return isPointInRect(point, { x, y, width, height })
  }

  // Check if point is near the border
  const outerRect = { x: x - threshold, y: y - threshold, width: width + threshold * 2, height: height + threshold * 2 }
  const innerRect = { x: x + threshold, y: y + threshold, width: width - threshold * 2, height: height - threshold * 2 }

  return isPointInRect(point, outerRect) && !isPointInRect(point, innerRect)
}

function hitTestEllipse(
  element: ExcalidrawElement,
  point: Point,
  threshold: number
): boolean {
  const { x, y, width, height, backgroundColor } = element
  const cx = x + width / 2
  const cy = y + height / 2
  const rx = width / 2
  const ry = height / 2
  const filled = backgroundColor !== 'transparent'

  if (filled) {
    return isPointInEllipse(point, cx, cy, rx, ry)
  }

  // Check if point is near the border
  const outerHit = isPointInEllipse(point, cx, cy, rx + threshold, ry + threshold)
  const innerHit = isPointInEllipse(point, cx, cy, Math.max(0, rx - threshold), Math.max(0, ry - threshold))

  return outerHit && !innerHit
}

function hitTestDiamond(
  element: ExcalidrawElement,
  point: Point,
  threshold: number
): boolean {
  const { x, y, width, height, backgroundColor } = element
  const filled = backgroundColor !== 'transparent'

  if (filled) {
    return isPointInDiamond(point, x, y, width, height)
  }

  // Check if point is near the border
  const outerHit = isPointInDiamond(point, x - threshold, y - threshold, width + threshold * 2, height + threshold * 2)
  const innerHit = isPointInDiamond(point, x + threshold, y + threshold, width - threshold * 2, height - threshold * 2)

  return outerHit && !innerHit
}

function hitTestLine(
  element: ExcalidrawElement,
  point: Point,
  threshold: number
): boolean {
  if (!element.points || element.points.length < 2) return false

  const absolutePoints = element.points.map(p => ({
    x: element.x + p.x,
    y: element.y + p.y,
  }))

  return isPointNearPolyline(point, absolutePoints, threshold + element.strokeWidth / 2)
}

function hitTestFreedraw(
  element: ExcalidrawElement,
  point: Point,
  threshold: number
): boolean {
  if (!element.points || element.points.length < 2) return false

  const absolutePoints = element.points.map(p => ({
    x: element.x + p.x,
    y: element.y + p.y,
  }))

  return isPointNearPolyline(point, absolutePoints, threshold + element.strokeWidth / 2)
}

function hitTestText(element: ExcalidrawElement, point: Point): boolean {
  return isPointInRect(point, {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  })
}

function hitTestImage(element: ExcalidrawElement, point: Point): boolean {
  return isPointInRect(point, {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  })
}

// Find the topmost element at a point
export function getElementAtPoint(
  elements: ExcalidrawElement[],
  point: Point
): ExcalidrawElement | null {
  // Iterate in reverse (top elements first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]
    if (!element.isDeleted && hitTestElement(element, point)) {
      return element
    }
  }
  return null
}

// Find all elements in a selection box
export function getElementsInBounds(
  elements: ExcalidrawElement[],
  bounds: { x: number; y: number; width: number; height: number }
): ExcalidrawElement[] {
  const result: ExcalidrawElement[] = []

  for (const element of elements) {
    if (element.isDeleted) continue

    const elBounds = getElementBounds(element)
    
    // Check if element bounds intersect with selection bounds
    const intersects =
      elBounds.x < bounds.x + bounds.width &&
      elBounds.x + elBounds.width > bounds.x &&
      elBounds.y < bounds.y + bounds.height &&
      elBounds.y + elBounds.height > bounds.y

    if (intersects) {
      result.push(element)
    }
  }

  return result
}

// Hit test for transform handles
const HANDLE_SIZE = 8

export function getTransformHandleAtPoint(
  bounds: { x: number; y: number; width: number; height: number },
  point: Point,
  zoom: number,
  angle: number = 0
): TransformHandle | null {
  const handleSize = HANDLE_SIZE / zoom
  const { x, y, width, height } = bounds
  
  // If there's rotation, transform the point to the element's local coordinate system
  let testPoint = point
  if (angle) {
    const cx = x + width / 2
    const cy = y + height / 2
    testPoint = rotatePoint(point, { x: cx, y: cy }, -angle)
  }

  const handles: { handle: TransformHandle; x: number; y: number }[] = [
    { handle: 'nw', x: x, y: y },
    { handle: 'n', x: x + width / 2, y: y },
    { handle: 'ne', x: x + width, y: y },
    { handle: 'e', x: x + width, y: y + height / 2 },
    { handle: 'se', x: x + width, y: y + height },
    { handle: 's', x: x + width / 2, y: y + height },
    { handle: 'sw', x: x, y: y + height },
    { handle: 'w', x: x, y: y + height / 2 },
    { handle: 'rotation', x: x + width / 2, y: y - 25 / zoom },
  ]

  for (const { handle, x: hx, y: hy } of handles) {
    if (
      testPoint.x >= hx - handleSize &&
      testPoint.x <= hx + handleSize &&
      testPoint.y >= hy - handleSize &&
      testPoint.y <= hy + handleSize
    ) {
      return handle
    }
  }

  return null
}

// Hit test for line/arrow endpoint handles
export function getLineEndpointAtPoint(
  element: ExcalidrawElement,
  point: Point,
  zoom: number
): TransformHandle | null {
  if (!element.points || element.points.length < 2) return null
  if (element.type !== 'line' && element.type !== 'arrow') return null

  const handleSize = HANDLE_SIZE / zoom + 4 / zoom // Slightly larger hit area

  // Check start point
  const startX = element.x + element.points[0].x
  const startY = element.y + element.points[0].y
  const distToStart = Math.sqrt(
    Math.pow(point.x - startX, 2) + Math.pow(point.y - startY, 2)
  )
  if (distToStart <= handleSize) {
    return 'start'
  }

  // Check end point
  const endIdx = element.points.length - 1
  const endX = element.x + element.points[endIdx].x
  const endY = element.y + element.points[endIdx].y
  const distToEnd = Math.sqrt(
    Math.pow(point.x - endX, 2) + Math.pow(point.y - endY, 2)
  )
  if (distToEnd <= handleSize) {
    return 'end'
  }

  return null
}

// Get cursor style for transform handle
export function getCursorForHandle(handle: TransformHandle | null): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'rotation':
      return 'grab'
    case 'start':
    case 'end':
      return 'crosshair'
    default:
      return 'default'
  }
}

