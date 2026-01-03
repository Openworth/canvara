import type { ExcalidrawElement, Point, PointBinding } from '../types'
import { distance, rotatePoint, isPointInRect, isPointInEllipse, isPointInDiamond } from './math'

// Distance threshold for snapping to an element
const BINDING_DISTANCE = 20

// Elements that can be bound to (shapes, not lines/arrows/freedraw/text)
const BINDABLE_ELEMENT_TYPES = ['rectangle', 'ellipse', 'diamond'] as const

/**
 * Check if an element type is bindable
 */
export function isBindableElement(element: ExcalidrawElement): boolean {
  return BINDABLE_ELEMENT_TYPES.includes(element.type as any)
}

/**
 * Get all bindable elements from the given list
 */
export function getBindableElements(elements: ExcalidrawElement[]): ExcalidrawElement[] {
  return elements.filter(el => !el.isDeleted && isBindableElement(el))
}

/**
 * Find the closest bindable element to a point within the binding distance
 */
export function findBindableElement(
  point: Point,
  elements: ExcalidrawElement[],
  excludeIds: string[] = []
): ExcalidrawElement | null {
  const bindableElements = getBindableElements(elements)
    .filter(el => !excludeIds.includes(el.id))
  
  let closestElement: ExcalidrawElement | null = null
  let closestDistance = BINDING_DISTANCE

  for (const element of bindableElements) {
    const dist = distanceToElement(point, element)
    if (dist !== null && dist < closestDistance) {
      closestDistance = dist
      closestElement = element
    }
  }

  return closestElement
}

/**
 * Check if a point is inside or near an element
 */
export function isPointInOrNearElement(
  point: Point,
  element: ExcalidrawElement,
  threshold: number = BINDING_DISTANCE
): boolean {
  const dist = distanceToElement(point, element)
  return dist !== null && dist <= threshold
}

/**
 * Calculate the distance from a point to an element's boundary
 * Returns null if the element type is not supported
 * Returns 0 or negative if point is inside the element
 */
export function distanceToElement(point: Point, element: ExcalidrawElement): number | null {
  // Handle rotation - rotate the point in the opposite direction
  let testPoint = point
  if (element.angle) {
    const center = {
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    }
    testPoint = rotatePoint(point, center, -element.angle)
  }

  switch (element.type) {
    case 'rectangle':
      return distanceToRectangle(testPoint, element)
    case 'ellipse':
      return distanceToEllipse(testPoint, element)
    case 'diamond':
      return distanceToDiamond(testPoint, element)
    default:
      return null
  }
}

function distanceToRectangle(point: Point, element: ExcalidrawElement): number {
  const { x, y, width, height } = element
  
  // Check if inside
  if (isPointInRect(point, { x, y, width, height })) {
    // Return distance to nearest edge (negative to indicate inside)
    const distToLeft = point.x - x
    const distToRight = x + width - point.x
    const distToTop = point.y - y
    const distToBottom = y + height - point.y
    return -Math.min(distToLeft, distToRight, distToTop, distToBottom)
  }
  
  // Find closest point on rectangle boundary
  const closestX = Math.max(x, Math.min(point.x, x + width))
  const closestY = Math.max(y, Math.min(point.y, y + height))
  
  return distance(point, { x: closestX, y: closestY })
}

function distanceToEllipse(point: Point, element: ExcalidrawElement): number {
  const { x, y, width, height } = element
  const cx = x + width / 2
  const cy = y + height / 2
  const rx = width / 2
  const ry = height / 2
  
  // Normalized distance from center
  const dx = point.x - cx
  const dy = point.y - cy
  const normalizedDist = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
  
  if (normalizedDist <= 1) {
    // Inside the ellipse
    // Approximate distance to edge
    const angle = Math.atan2(dy / ry, dx / rx)
    const edgeX = cx + rx * Math.cos(angle)
    const edgeY = cy + ry * Math.sin(angle)
    return -distance(point, { x: edgeX, y: edgeY })
  }
  
  // Outside - find closest point on ellipse (approximate)
  const angle = Math.atan2(dy / ry, dx / rx)
  const edgeX = cx + rx * Math.cos(angle)
  const edgeY = cy + ry * Math.sin(angle)
  return distance(point, { x: edgeX, y: edgeY })
}

function distanceToDiamond(point: Point, element: ExcalidrawElement): number {
  const { x, y, width, height } = element
  
  if (isPointInDiamond(point, x, y, width, height)) {
    // Inside - calculate distance to nearest edge
    const cx = x + width / 2
    const cy = y + height / 2
    const edgePoint = getIntersectionOnDiamond(point, { x: cx, y: cy }, element)
    return -distance(point, edgePoint)
  }
  
  // Outside - find closest point on diamond
  const cx = x + width / 2
  const cy = y + height / 2
  const edgePoint = getIntersectionOnDiamond(point, { x: cx, y: cy }, element)
  return distance(point, edgePoint)
}

/**
 * Calculate the intersection point where a line from the center to a point
 * intersects with the element's boundary
 */
export function getIntersectionPoint(
  point: Point,
  element: ExcalidrawElement
): Point {
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }

  // Handle rotation
  let testPoint = point
  if (element.angle) {
    testPoint = rotatePoint(point, center, -element.angle)
  }

  let intersection: Point
  
  switch (element.type) {
    case 'rectangle':
      intersection = getIntersectionOnRectangle(testPoint, center, element)
      break
    case 'ellipse':
      intersection = getIntersectionOnEllipse(testPoint, center, element)
      break
    case 'diamond':
      intersection = getIntersectionOnDiamond(testPoint, center, element)
      break
    default:
      intersection = center
  }

  // Rotate the intersection point back if the element is rotated
  if (element.angle) {
    intersection = rotatePoint(intersection, center, element.angle)
  }

  return intersection
}

function getIntersectionOnRectangle(
  point: Point,
  center: Point,
  element: ExcalidrawElement
): Point {
  const { x, y, width, height } = element
  
  const dx = point.x - center.x
  const dy = point.y - center.y
  
  if (dx === 0 && dy === 0) {
    // Point is at center, return top edge
    return { x: center.x, y }
  }
  
  // Calculate intersection with each edge
  const halfWidth = width / 2
  const halfHeight = height / 2
  
  // Scale factor to reach each edge
  const scaleX = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity
  
  const scale = Math.min(scaleX, scaleY)
  
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  }
}

function getIntersectionOnEllipse(
  point: Point,
  center: Point,
  element: ExcalidrawElement
): Point {
  const rx = element.width / 2
  const ry = element.height / 2
  
  const dx = point.x - center.x
  const dy = point.y - center.y
  
  if (dx === 0 && dy === 0) {
    // Point is at center, return top edge
    return { x: center.x, y: center.y - ry }
  }
  
  // Calculate angle to point
  const angle = Math.atan2(dy, dx)
  
  return {
    x: center.x + rx * Math.cos(angle),
    y: center.y + ry * Math.sin(angle),
  }
}

function getIntersectionOnDiamond(
  point: Point,
  center: Point,
  element: ExcalidrawElement
): Point {
  const { x, y, width, height } = element
  const halfWidth = width / 2
  const halfHeight = height / 2
  
  const dx = point.x - center.x
  const dy = point.y - center.y
  
  if (dx === 0 && dy === 0) {
    // Point is at center, return top vertex
    return { x: center.x, y }
  }
  
  // Diamond vertices
  const top = { x: center.x, y }
  const right = { x: x + width, y: center.y }
  const bottom = { x: center.x, y: y + height }
  const left = { x, y: center.y }
  
  // Determine which edge the line intersects
  const angle = Math.atan2(dy, dx)
  const absAngle = Math.abs(angle)
  
  let p1: Point, p2: Point
  
  if (absAngle <= Math.PI / 4) {
    // Right edge
    p1 = right
    p2 = dy >= 0 ? bottom : top
  } else if (absAngle >= (3 * Math.PI) / 4) {
    // Left edge
    p1 = left
    p2 = dy >= 0 ? bottom : top
  } else if (angle > 0) {
    // Bottom edge
    p1 = bottom
    p2 = dx >= 0 ? right : left
  } else {
    // Top edge
    p1 = top
    p2 = dx >= 0 ? right : left
  }
  
  // Line intersection calculation
  const x1 = center.x, y1 = center.y
  const x2 = point.x, y2 = point.y
  const x3 = p1.x, y3 = p1.y
  const x4 = p2.x, y4 = p2.y
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  
  if (Math.abs(denom) < 0.001) {
    // Lines are parallel, return edge midpoint
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  }
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  }
}

/**
 * Calculate the "focus" value for a binding
 * This is the angle from the element's center to the arrow point, stored as radians
 * This allows us to maintain the same connection position when the element moves
 */
export function calculateFocus(
  point: Point,
  element: ExcalidrawElement
): number {
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }

  // Handle rotation - we want the angle in the element's local coordinate system
  let testPoint = point
  if (element.angle) {
    testPoint = rotatePoint(point, center, -element.angle)
  }

  const dx = testPoint.x - center.x
  const dy = testPoint.y - center.y
  
  // Return the angle in radians
  return Math.atan2(dy, dx)
}

/**
 * Get the point on the element's boundary at a given focus angle
 */
export function getPointAtFocus(
  focus: number,
  element: ExcalidrawElement
): Point {
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }
  
  // Create a point far away in the direction of the focus angle
  const farPoint = {
    x: center.x + Math.cos(focus) * 10000,
    y: center.y + Math.sin(focus) * 10000,
  }
  
  // Get the intersection with the element boundary (in local coordinates)
  let intersection: Point
  
  switch (element.type) {
    case 'rectangle':
      intersection = getIntersectionOnRectangle(farPoint, center, element)
      break
    case 'ellipse':
      intersection = getIntersectionOnEllipse(farPoint, center, element)
      break
    case 'diamond':
      intersection = getIntersectionOnDiamond(farPoint, center, element)
      break
    default:
      intersection = center
  }

  // Rotate back if element is rotated
  if (element.angle) {
    intersection = rotatePoint(intersection, center, element.angle)
  }

  return intersection
}

/**
 * Calculate the gap (distance) from the arrow point to the element's edge
 */
export function calculateGap(
  arrowPoint: Point,
  element: ExcalidrawElement
): number {
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  }
  
  // Get the intersection point in the direction of the arrow point
  const intersection = getIntersectionPoint(arrowPoint, element)
  
  // Calculate signed distance - positive if outside, negative if inside
  const distToCenter = distance(arrowPoint, center)
  const edgeToCenter = distance(intersection, center)
  
  // Gap is the distance from the arrow point to the edge
  return distToCenter - edgeToCenter
}

/**
 * Create a binding object for an arrow endpoint
 */
export function createBinding(
  arrowPoint: Point,
  element: ExcalidrawElement
): PointBinding {
  return {
    elementId: element.id,
    focus: calculateFocus(arrowPoint, element),
    gap: calculateGap(arrowPoint, element),
  }
}

/**
 * Get the arrow endpoint position based on a binding
 * This uses the stored focus angle and gap to calculate where the arrow should be
 */
export function getBindingPoint(
  binding: PointBinding,
  boundElement: ExcalidrawElement
): Point {
  const center = {
    x: boundElement.x + boundElement.width / 2,
    y: boundElement.y + boundElement.height / 2,
  }
  
  // Get the point on the element's boundary at the stored focus angle
  const edgePoint = getPointAtFocus(binding.focus, boundElement)
  
  // Apply the gap - move outward from center by the gap amount
  if (binding.gap !== 0) {
    const dx = edgePoint.x - center.x
    const dy = edgePoint.y - center.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist > 0) {
      return {
        x: edgePoint.x + (dx / dist) * binding.gap,
        y: edgePoint.y + (dy / dist) * binding.gap,
      }
    }
  }
  
  return edgePoint
}

/**
 * Get all elements that an arrow is bound to
 */
export function getBoundElements(
  arrow: ExcalidrawElement,
  elements: ExcalidrawElement[]
): { start: ExcalidrawElement | null; end: ExcalidrawElement | null } {
  const result: { start: ExcalidrawElement | null; end: ExcalidrawElement | null } = {
    start: null,
    end: null,
  }

  if (arrow.startBinding?.elementId) {
    result.start = elements.find(el => el.id === arrow.startBinding!.elementId && !el.isDeleted) || null
  }
  if (arrow.endBinding?.elementId) {
    result.end = elements.find(el => el.id === arrow.endBinding!.elementId && !el.isDeleted) || null
  }

  return result
}

/**
 * Update arrow points based on its bindings
 */
export function updateArrowBinding(
  arrow: ExcalidrawElement,
  elements: ExcalidrawElement[]
): Partial<ExcalidrawElement> | null {
  if (!arrow.points || arrow.points.length < 2) return null
  if (!arrow.startBinding && !arrow.endBinding) return null

  const { start: startElement, end: endElement } = getBoundElements(arrow, elements)
  
  const newPoints = [...arrow.points.map(p => ({ ...p }))]
  let newX = arrow.x
  let newY = arrow.y
  let changed = false

  // Get current absolute endpoints
  const startAbsolute = {
    x: arrow.x + newPoints[0].x,
    y: arrow.y + newPoints[0].y,
  }

  // Update end binding
  if (endElement && arrow.endBinding) {
    const newEndPoint = getBindingPoint(arrow.endBinding, endElement)
    const newRelativeEnd = {
      x: newEndPoint.x - arrow.x,
      y: newEndPoint.y - arrow.y,
    }
    
    // Only update if position actually changed
    if (Math.abs(newRelativeEnd.x - newPoints[newPoints.length - 1].x) > 0.01 ||
        Math.abs(newRelativeEnd.y - newPoints[newPoints.length - 1].y) > 0.01) {
      newPoints[newPoints.length - 1] = newRelativeEnd
      changed = true
    }
  }

  // Update start binding
  if (startElement && arrow.startBinding) {
    const newStartPoint = getBindingPoint(arrow.startBinding, startElement)
    
    // Only update if position actually changed
    if (Math.abs(newStartPoint.x - startAbsolute.x) > 0.01 ||
        Math.abs(newStartPoint.y - startAbsolute.y) > 0.01) {
      // Calculate delta from current start position
      const deltaX = newStartPoint.x - startAbsolute.x
      const deltaY = newStartPoint.y - startAbsolute.y
      
      newX = arrow.x + deltaX
      newY = arrow.y + deltaY
      
      // Adjust other points to compensate for position change
      for (let i = 1; i < newPoints.length; i++) {
        newPoints[i] = {
          x: newPoints[i].x - deltaX,
          y: newPoints[i].y - deltaY,
        }
      }
      changed = true
    }
  }

  if (!changed) return null

  return {
    x: newX,
    y: newY,
    points: newPoints,
    width: Math.abs(newPoints[newPoints.length - 1].x),
    height: Math.abs(newPoints[newPoints.length - 1].y),
  }
}
