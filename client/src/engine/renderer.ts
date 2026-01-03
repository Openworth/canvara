import rough from 'roughjs'
import type { RoughCanvas } from 'roughjs/bin/canvas'
import type { ExcalidrawElement, Collaborator, AppState } from '../types'
import { getCommonBounds, canvasToScreen } from './math'

const HANDLE_SIZE = 8
const ROTATION_HANDLE_OFFSET = 25

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rc: RoughCanvas
  private dpr: number

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.rc = rough.canvas(canvas)
    this.dpr = window.devicePixelRatio || 1
  }

  // Resize canvas to match container
  resize(width: number, height: number) {
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = width * this.dpr
    this.canvas.height = height * this.dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.scale(this.dpr, this.dpr)
  }

  // Clear the canvas
  clear(backgroundColor: string = '#ffffff') {
    this.ctx.save()
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.fillStyle = backgroundColor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  // Render grid
  renderGrid(appState: AppState, isDarkMode: boolean = false) {
    if (!appState.showGrid || !appState.gridSize) return

    const { scrollX, scrollY, zoom } = appState
    const gridSize = appState.gridSize * zoom.value
    const width = this.canvas.width / this.dpr
    const height = this.canvas.height / this.dpr

    this.ctx.save()
    // Use subtle colors that work in both light and dark mode
    this.ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
    this.ctx.lineWidth = 1

    // Calculate grid offset based on scroll
    const offsetX = (scrollX % gridSize + gridSize) % gridSize
    const offsetY = (scrollY % gridSize + gridSize) % gridSize

    // Draw vertical lines
    for (let x = offsetX; x < width; x += gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(x, height)
      this.ctx.stroke()
    }

    // Draw horizontal lines
    for (let y = offsetY; y < height; y += gridSize) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y)
      this.ctx.lineTo(width, y)
      this.ctx.stroke()
    }

    this.ctx.restore()
  }

  // Render all elements
  renderElements(
    elements: ExcalidrawElement[],
    appState: AppState,
    selectedIds: Set<string>
  ) {
    const { scrollX, scrollY, zoom } = appState

    this.ctx.save()
    this.ctx.translate(scrollX, scrollY)
    this.ctx.scale(zoom.value, zoom.value)

    // Render each element
    for (const element of elements) {
      if (element.isDeleted) continue
      this.renderElement(element)
    }

    // Render selection UI on top
    const selectedElements = elements.filter(el => selectedIds.has(el.id) && !el.isDeleted)
    if (selectedElements.length > 0) {
      this.renderSelectionUI(selectedElements, zoom.value)
    }

    this.ctx.restore()
  }

  // Render a single element
  private renderElement(element: ExcalidrawElement) {
    this.ctx.save()

    // Apply rotation
    if (element.angle) {
      const cx = element.x + element.width / 2
      const cy = element.y + element.height / 2
      this.ctx.translate(cx, cy)
      this.ctx.rotate(element.angle)
      this.ctx.translate(-cx, -cy)
    }

    // Apply opacity
    this.ctx.globalAlpha = element.opacity / 100

    switch (element.type) {
      case 'rectangle':
        this.renderRectangle(element)
        break
      case 'ellipse':
        this.renderEllipse(element)
        break
      case 'diamond':
        this.renderDiamond(element)
        break
      case 'line':
        this.renderLine(element)
        break
      case 'arrow':
        this.renderArrow(element)
        break
      case 'freedraw':
        this.renderFreedraw(element)
        break
      case 'text':
        this.renderText(element)
        break
      case 'image':
        this.renderImage(element)
        break
    }

    this.ctx.restore()
  }

  private getRoughOptions(element: ExcalidrawElement) {
    const dashGap = element.strokeStyle === 'dashed' ? [12, 8] : element.strokeStyle === 'dotted' ? [3, 6] : undefined
    
    return {
      seed: element.seed,
      roughness: element.roughness,
      bowing: element.roughness, // Add bowing for more visible hand-drawn effect on lines
      strokeWidth: element.strokeWidth,
      stroke: element.strokeColor,
      fill: element.backgroundColor !== 'transparent' ? element.backgroundColor : undefined,
      fillStyle: element.fillStyle === 'none' ? undefined : element.fillStyle,
      strokeLineDash: dashGap,
    }
  }

  private renderRectangle(element: ExcalidrawElement) {
    const { x, y, width, height, roundness } = element
    const options = this.getRoughOptions(element)

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
      
      this.rc.path(path, options)
    } else {
      this.rc.rectangle(x, y, width, height, options)
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.moveTo(x + r, y)
    this.ctx.arcTo(x + w, y, x + w, y + h, r)
    this.ctx.arcTo(x + w, y + h, x, y + h, r)
    this.ctx.arcTo(x, y + h, x, y, r)
    this.ctx.arcTo(x, y, x + w, y, r)
    this.ctx.closePath()
  }

  private renderEllipse(element: ExcalidrawElement) {
    const { x, y, width, height } = element
    const cx = x + width / 2
    const cy = y + height / 2
    const options = this.getRoughOptions(element)

    this.rc.ellipse(cx, cy, width, height, options)
  }

  private renderDiamond(element: ExcalidrawElement) {
    const { x, y, width, height } = element
    const cx = x + width / 2
    const cy = y + height / 2
    const options = this.getRoughOptions(element)

    const points: [number, number][] = [
      [cx, y],
      [x + width, cy],
      [cx, y + height],
      [x, cy],
    ]

    this.rc.polygon(points, options)
  }

  private renderLine(element: ExcalidrawElement) {
    if (!element.points || element.points.length < 2) return

    const options = this.getRoughOptions(element)
    const points: [number, number][] = element.points.map(p => [
      element.x + p.x,
      element.y + p.y,
    ])

    if (points.length === 2) {
      this.rc.line(points[0][0], points[0][1], points[1][0], points[1][1], options)
    } else {
      this.rc.linearPath(points, options)
    }
  }

  private renderArrow(element: ExcalidrawElement) {
    if (!element.points || element.points.length < 2) return

    const options = this.getRoughOptions(element)
    const points: [number, number][] = element.points.map(p => [
      element.x + p.x,
      element.y + p.y,
    ])

    // Draw the line
    if (points.length === 2) {
      this.rc.line(points[0][0], points[0][1], points[1][0], points[1][1], options)
    } else {
      this.rc.linearPath(points, options)
    }

    // Draw arrowhead at the end
    if (element.endArrowhead && element.endArrowhead !== 'none') {
      const lastPoint = points[points.length - 1]
      const secondLast = points[points.length - 2]
      this.renderArrowhead(secondLast, lastPoint, element, element.endArrowhead)
    }

    // Draw arrowhead at the start
    if (element.startArrowhead && element.startArrowhead !== 'none') {
      const firstPoint = points[0]
      const second = points[1]
      this.renderArrowhead(second, firstPoint, element, element.startArrowhead)
    }
  }

  private renderArrowhead(
    from: [number, number],
    to: [number, number],
    element: ExcalidrawElement,
    type: 'arrow' | 'bar' | 'dot' | 'triangle'
  ) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
    const size = 15 + element.strokeWidth * 2

    this.ctx.save()
    this.ctx.strokeStyle = element.strokeColor
    this.ctx.lineWidth = element.strokeWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    switch (type) {
      case 'arrow': {
        const p1: [number, number] = [
          to[0] - size * Math.cos(angle - Math.PI / 6),
          to[1] - size * Math.sin(angle - Math.PI / 6),
        ]
        const p2: [number, number] = [
          to[0] - size * Math.cos(angle + Math.PI / 6),
          to[1] - size * Math.sin(angle + Math.PI / 6),
        ]
        const options = this.getRoughOptions(element)
        this.rc.linearPath([p1, to, p2], options)
        break
      }

      case 'triangle': {
        const p1: [number, number] = [
          to[0] - size * Math.cos(angle - Math.PI / 6),
          to[1] - size * Math.sin(angle - Math.PI / 6),
        ]
        const p2: [number, number] = [
          to[0] - size * Math.cos(angle + Math.PI / 6),
          to[1] - size * Math.sin(angle + Math.PI / 6),
        ]
        this.ctx.beginPath()
        this.ctx.moveTo(to[0], to[1])
        this.ctx.lineTo(p1[0], p1[1])
        this.ctx.lineTo(p2[0], p2[1])
        this.ctx.closePath()
        this.ctx.fillStyle = element.strokeColor
        this.ctx.fill()
        this.ctx.stroke()
        break
      }

      case 'bar': {
        const barSize = size * 0.6
        const p1: [number, number] = [
          to[0] - barSize * Math.cos(angle - Math.PI / 2),
          to[1] - barSize * Math.sin(angle - Math.PI / 2),
        ]
        const p2: [number, number] = [
          to[0] - barSize * Math.cos(angle + Math.PI / 2),
          to[1] - barSize * Math.sin(angle + Math.PI / 2),
        ]
        this.ctx.beginPath()
        this.ctx.moveTo(p1[0], p1[1])
        this.ctx.lineTo(p2[0], p2[1])
        this.ctx.stroke()
        break
      }

      case 'dot': {
        const dotRadius = size * 0.3
        this.ctx.beginPath()
        this.ctx.arc(to[0], to[1], dotRadius, 0, Math.PI * 2)
        this.ctx.fillStyle = element.strokeColor
        this.ctx.fill()
        break
      }
    }

    this.ctx.restore()
  }

  private renderFreedraw(element: ExcalidrawElement) {
    if (!element.points || element.points.length < 2) return

    this.ctx.save()
    this.ctx.strokeStyle = element.strokeColor
    this.ctx.lineWidth = element.strokeWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    if (element.strokeStyle === 'dashed') {
      this.ctx.setLineDash([12, 8])
    } else if (element.strokeStyle === 'dotted') {
      this.ctx.setLineDash([3, 6])
    }

    this.ctx.beginPath()
    this.ctx.moveTo(element.x + element.points[0].x, element.y + element.points[0].y)

    for (let i = 1; i < element.points.length; i++) {
      this.ctx.lineTo(element.x + element.points[i].x, element.y + element.points[i].y)
    }

    this.ctx.stroke()
    this.ctx.restore()
  }

  private renderText(element: ExcalidrawElement) {
    if (!element.text) return

    this.ctx.save()

    let fontFamily = 'system-ui'
    if (element.fontFamily === 'virgil') {
      fontFamily = '"Caveat", "Virgil", cursive'
    } else if (element.fontFamily === 'code') {
      fontFamily = '"Fira Code", "Cascadia Code", monospace'
    }

    this.ctx.font = `${element.fontSize}px ${fontFamily}`
    this.ctx.fillStyle = element.strokeColor
    this.ctx.textAlign = element.textAlign || 'center'
    this.ctx.textBaseline = 'middle'

    const lines = element.text.split('\n')
    const lineHeight = (element.fontSize || 20) * (element.lineHeight || 1.25)
    const totalTextHeight = lines.length * lineHeight

    // Center horizontally
    let x = element.x + element.width / 2
    if (element.textAlign === 'left') {
      x = element.x
      this.ctx.textAlign = 'left'
    } else if (element.textAlign === 'right') {
      x = element.x + element.width
      this.ctx.textAlign = 'right'
    }

    // Center vertically
    const startY = element.y + (element.height - totalTextHeight) / 2 + lineHeight / 2

    lines.forEach((line, i) => {
      this.ctx.fillText(line, x, startY + i * lineHeight)
    })

    this.ctx.restore()
  }

  private renderImage(element: ExcalidrawElement) {
    // Image rendering would require loading and caching images
    // For now, render a placeholder
    this.ctx.save()
    this.ctx.fillStyle = '#f0f0f0'
    this.ctx.fillRect(element.x, element.y, element.width, element.height)
    this.ctx.strokeStyle = '#ccc'
    this.ctx.strokeRect(element.x, element.y, element.width, element.height)
    
    // Draw X pattern
    this.ctx.strokeStyle = '#ddd'
    this.ctx.beginPath()
    this.ctx.moveTo(element.x, element.y)
    this.ctx.lineTo(element.x + element.width, element.y + element.height)
    this.ctx.moveTo(element.x + element.width, element.y)
    this.ctx.lineTo(element.x, element.y + element.height)
    this.ctx.stroke()
    
    this.ctx.restore()
  }

  // Render selection UI (bounding box and handles)
  private renderSelectionUI(elements: ExcalidrawElement[], zoom: number) {
    if (elements.length === 0) return

    const handleSize = HANDLE_SIZE / zoom

    // For single line/arrow element, draw endpoint handles instead of bounding box
    if (elements.length === 1 && (elements[0].type === 'line' || elements[0].type === 'arrow')) {
      this.renderLineSelectionUI(elements[0], zoom, handleSize)
      return
    }

    // For single element with rotation, draw rotated selection box
    if (elements.length === 1 && elements[0].angle) {
      this.renderRotatedSelectionUI(elements[0], zoom, handleSize)
      return
    }

    // For multiple elements or no rotation, use axis-aligned box
    const bounds = getCommonBounds(elements)
    if (!bounds) return

    const { x, y, width, height } = bounds

    this.ctx.save()

    // Selection box
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom
    this.ctx.setLineDash([5 / zoom, 5 / zoom])
    this.ctx.strokeRect(x, y, width, height)
    this.ctx.setLineDash([])

    // Resize handles
    const handles = [
      { x: x, y: y },                           // nw
      { x: x + width / 2, y: y },               // n
      { x: x + width, y: y },                   // ne
      { x: x + width, y: y + height / 2 },      // e
      { x: x + width, y: y + height },          // se
      { x: x + width / 2, y: y + height },      // s
      { x: x, y: y + height },                  // sw
      { x: x, y: y + height / 2 },              // w
    ]

    this.ctx.fillStyle = '#ffffff'
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom

    handles.forEach(h => {
      this.ctx.beginPath()
      this.ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
      this.ctx.fill()
      this.ctx.stroke()
    })

    // Rotation handle
    const rotationHandleY = y - ROTATION_HANDLE_OFFSET / zoom
    
    // Line to rotation handle
    this.ctx.beginPath()
    this.ctx.moveTo(x + width / 2, y)
    this.ctx.lineTo(x + width / 2, rotationHandleY)
    this.ctx.stroke()

    // Rotation handle circle
    this.ctx.beginPath()
    this.ctx.arc(x + width / 2, rotationHandleY, handleSize / 2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.restore()
  }

  // Render selection UI for lines and arrows (endpoint handles only)
  private renderLineSelectionUI(element: ExcalidrawElement, zoom: number, handleSize: number) {
    if (!element.points || element.points.length < 2) return

    this.ctx.save()
    this.ctx.fillStyle = '#ffffff'
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom

    // Draw circular handles at each endpoint
    element.points.forEach((pt) => {
      const px = element.x + pt.x
      const py = element.y + pt.y

      this.ctx.beginPath()
      this.ctx.arc(px, py, handleSize / 2 + 2 / zoom, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.stroke()
    })

    this.ctx.restore()
  }

  // Render selection UI for a rotated element
  private renderRotatedSelectionUI(element: ExcalidrawElement, zoom: number, handleSize: number) {
    const { x, y, width, height, angle } = element
    const cx = x + width / 2
    const cy = y + height / 2

    this.ctx.save()
    
    // Translate to center and rotate
    this.ctx.translate(cx, cy)
    this.ctx.rotate(angle || 0)

    // Selection box (centered at origin after translation)
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom
    this.ctx.setLineDash([5 / zoom, 5 / zoom])
    this.ctx.strokeRect(-width / 2, -height / 2, width, height)
    this.ctx.setLineDash([])

    // Resize handles (relative to center)
    const handles = [
      { x: -width / 2, y: -height / 2 },           // nw
      { x: 0, y: -height / 2 },                     // n
      { x: width / 2, y: -height / 2 },            // ne
      { x: width / 2, y: 0 },                       // e
      { x: width / 2, y: height / 2 },             // se
      { x: 0, y: height / 2 },                      // s
      { x: -width / 2, y: height / 2 },            // sw
      { x: -width / 2, y: 0 },                      // w
    ]

    this.ctx.fillStyle = '#ffffff'
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom

    handles.forEach(h => {
      this.ctx.beginPath()
      this.ctx.rect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
      this.ctx.fill()
      this.ctx.stroke()
    })

    // Rotation handle
    const rotationHandleOffset = ROTATION_HANDLE_OFFSET / zoom
    
    // Line to rotation handle
    this.ctx.beginPath()
    this.ctx.moveTo(0, -height / 2)
    this.ctx.lineTo(0, -height / 2 - rotationHandleOffset)
    this.ctx.stroke()

    // Rotation handle circle
    this.ctx.beginPath()
    this.ctx.arc(0, -height / 2 - rotationHandleOffset, handleSize / 2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.restore()
  }

  // Render selection box while dragging
  renderSelectionBox(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    appState: AppState
  ) {
    const { scrollX, scrollY, zoom } = appState
    
    this.ctx.save()
    this.ctx.translate(scrollX, scrollY)
    this.ctx.scale(zoom.value, zoom.value)

    const x = Math.min(startX, endX)
    const y = Math.min(startY, endY)
    const width = Math.abs(endX - startX)
    const height = Math.abs(endY - startY)

    this.ctx.fillStyle = 'rgba(105, 101, 219, 0.1)'
    this.ctx.fillRect(x, y, width, height)
    
    this.ctx.strokeStyle = '#6965db'
    this.ctx.lineWidth = 1 / zoom.value
    this.ctx.strokeRect(x, y, width, height)

    this.ctx.restore()
  }

  // Render collaborator cursors
  renderCollaborators(
    collaborators: Collaborator[],
    appState: AppState
  ) {
    const { scrollX, scrollY, zoom } = appState

    this.ctx.save()

    for (const collab of collaborators) {
      if (!collab.cursor || collab.isCurrentUser) continue

      const screenPos = canvasToScreen(
        collab.cursor.x,
        collab.cursor.y,
        scrollX,
        scrollY,
        zoom.value
      )

      // Draw cursor
      this.ctx.save()
      this.ctx.translate(screenPos.x, screenPos.y)

      // Cursor shape
      this.ctx.fillStyle = collab.color
      this.ctx.beginPath()
      this.ctx.moveTo(0, 0)
      this.ctx.lineTo(0, 16)
      this.ctx.lineTo(4, 12)
      this.ctx.lineTo(8, 20)
      this.ctx.lineTo(12, 18)
      this.ctx.lineTo(7, 11)
      this.ctx.lineTo(12, 8)
      this.ctx.closePath()
      this.ctx.fill()

      // Username label
      this.ctx.fillStyle = collab.color
      this.ctx.fillRect(12, 16, collab.username.length * 7 + 8, 20)
      this.ctx.fillStyle = '#ffffff'
      this.ctx.font = '12px system-ui'
      this.ctx.fillText(collab.username, 16, 30)

      this.ctx.restore()
    }

    this.ctx.restore()
  }

  // Render currently drawing element (preview)
  renderDrawingElement(
    element: ExcalidrawElement | null,
    appState: AppState
  ) {
    if (!element) return

    const { scrollX, scrollY, zoom } = appState

    this.ctx.save()
    this.ctx.translate(scrollX, scrollY)
    this.ctx.scale(zoom.value, zoom.value)

    this.renderElement(element)

    this.ctx.restore()
  }

  // Render binding highlights when arrow endpoint is near a bindable element
  renderBindingHighlights(
    elements: ExcalidrawElement[],
    appState: AppState
  ) {
    if (elements.length === 0) return

    const { scrollX, scrollY, zoom } = appState

    this.ctx.save()
    this.ctx.translate(scrollX, scrollY)
    this.ctx.scale(zoom.value, zoom.value)

    for (const element of elements) {
      this.renderBindingHighlight(element, zoom.value)
    }

    this.ctx.restore()
  }

  private renderBindingHighlight(element: ExcalidrawElement, zoom: number) {
    const { x, y, width, height, angle } = element
    const cx = x + width / 2
    const cy = y + height / 2

    this.ctx.save()

    // Apply rotation if needed
    if (angle) {
      this.ctx.translate(cx, cy)
      this.ctx.rotate(angle)
      this.ctx.translate(-cx, -cy)
    }

    // Set highlight style - blue glow effect
    this.ctx.strokeStyle = '#4dabf7'
    this.ctx.lineWidth = 3 / zoom
    this.ctx.setLineDash([])

    // Draw highlight based on element type
    switch (element.type) {
      case 'rectangle':
        const radius = element.roundness ? Math.min(width, height) * 0.1 : 0
        this.ctx.beginPath()
        if (radius > 0) {
          this.roundRect(x, y, width, height, radius)
        } else {
          this.ctx.rect(x, y, width, height)
        }
        this.ctx.stroke()
        break

      case 'ellipse':
        this.ctx.beginPath()
        this.ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2)
        this.ctx.stroke()
        break

      case 'diamond':
        this.ctx.beginPath()
        this.ctx.moveTo(cx, y)
        this.ctx.lineTo(x + width, cy)
        this.ctx.lineTo(cx, y + height)
        this.ctx.lineTo(x, cy)
        this.ctx.closePath()
        this.ctx.stroke()
        break
    }

    // Add a subtle glow effect
    this.ctx.shadowColor = '#4dabf7'
    this.ctx.shadowBlur = 10 / zoom

    this.ctx.restore()
  }
}

