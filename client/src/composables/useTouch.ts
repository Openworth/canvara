import { ref, onMounted, onUnmounted } from 'vue'
import type { Point } from '../types'

export interface TouchState {
  touches: Touch[]
  startDistance: number | null
  startZoom: number
  startCenter: Point | null
  isPinching: boolean
}

export function useTouch(
  element: () => HTMLElement | null,
  callbacks: {
    onPinchStart?: () => void
    onPinchMove?: (scale: number, center: Point) => void
    onPinchEnd?: () => void
    onTwoFingerPan?: (delta: Point) => void
  }
) {
  const state = ref<TouchState>({
    touches: [],
    startDistance: null,
    startZoom: 1,
    startCenter: null,
    isPinching: false,
  })

  function getDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getCenter(t1: Touch, t2: Touch): Point {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      
      state.value.startDistance = getDistance(t1, t2)
      state.value.startCenter = getCenter(t1, t2)
      state.value.isPinching = true
      
      callbacks.onPinchStart?.()
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && state.value.isPinching) {
      e.preventDefault()
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      
      const currentDistance = getDistance(t1, t2)
      const currentCenter = getCenter(t1, t2)
      
      if (state.value.startDistance) {
        const scale = currentDistance / state.value.startDistance
        callbacks.onPinchMove?.(scale, currentCenter)
      }
      
      if (state.value.startCenter) {
        const delta = {
          x: currentCenter.x - state.value.startCenter.x,
          y: currentCenter.y - state.value.startCenter.y,
        }
        callbacks.onTwoFingerPan?.(delta)
        state.value.startCenter = currentCenter
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2 && state.value.isPinching) {
      state.value.isPinching = false
      state.value.startDistance = null
      state.value.startCenter = null
      callbacks.onPinchEnd?.()
    }
  }

  onMounted(() => {
    const el = element()
    if (el) {
      el.addEventListener('touchstart', handleTouchStart, { passive: false })
      el.addEventListener('touchmove', handleTouchMove, { passive: false })
      el.addEventListener('touchend', handleTouchEnd)
      el.addEventListener('touchcancel', handleTouchEnd)
    }
  })

  onUnmounted(() => {
    const el = element()
    if (el) {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  })

  return state
}

