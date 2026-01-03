<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

// Tooltip state
const visible = ref(false)
const text = ref('')
const x = ref(0)
const y = ref(0)
const placement = ref<'top' | 'bottom' | 'left' | 'right'>('top')

// Store the target element rect for arrow positioning
const targetRect = ref<DOMRect | null>(null)

// Offset from the element
const OFFSET = 8
const PADDING = 8 // Minimum distance from viewport edge

// Calculate arrow position based on where the target element actually is
const arrowStyle = computed(() => {
  if (!targetRect.value) return {}
  
  const rect = targetRect.value
  
  if (placement.value === 'top' || placement.value === 'bottom') {
    // Arrow should point to center of target element
    const targetCenterX = rect.left + rect.width / 2
    const arrowX = targetCenterX - x.value
    // Clamp arrow position to stay within tooltip bounds (with some padding)
    const clampedX = Math.max(10, Math.min(arrowX, 200))
    return { left: `${clampedX}px`, marginLeft: '-4px' }
  } else {
    // Left/right placement - arrow should point to center of target element vertically
    const targetCenterY = rect.top + rect.height / 2
    const arrowY = targetCenterY - y.value
    const clampedY = Math.max(10, Math.min(arrowY, 100))
    return { top: `${clampedY}px`, marginTop: '-4px' }
  }
})

function updatePosition(rect: DOMRect, preferredPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top') {
  targetRect.value = rect
  
  nextTick(() => {
    const tooltip = document.getElementById('global-tooltip')
    if (!tooltip) return

    const tooltipRect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let finalPlacement = preferredPlacement
    let finalX = 0
    let finalY = 0

    // Calculate positions for each placement
    const positions = {
      top: {
        x: rect.left + rect.width / 2 - tooltipRect.width / 2,
        y: rect.top - tooltipRect.height - OFFSET
      },
      bottom: {
        x: rect.left + rect.width / 2 - tooltipRect.width / 2,
        y: rect.bottom + OFFSET
      },
      left: {
        x: rect.left - tooltipRect.width - OFFSET,
        y: rect.top + rect.height / 2 - tooltipRect.height / 2
      },
      right: {
        x: rect.right + OFFSET,
        y: rect.top + rect.height / 2 - tooltipRect.height / 2
      }
    }

    // Check if preferred placement fits
    const pos = positions[preferredPlacement]
    const fits = {
      top: pos.y > PADDING,
      bottom: pos.y + tooltipRect.height < viewportHeight - PADDING,
      left: pos.x > PADDING,
      right: pos.x + tooltipRect.width < viewportWidth - PADDING
    }

    // Find fallback if needed
    if (!fits[preferredPlacement]) {
      const fallbacks: Record<string, ('top' | 'bottom' | 'left' | 'right')[]> = {
        top: ['bottom', 'right', 'left'],
        bottom: ['top', 'right', 'left'],
        left: ['right', 'top', 'bottom'],
        right: ['left', 'top', 'bottom']
      }

      for (const fb of fallbacks[preferredPlacement]) {
        if (fits[fb]) {
          finalPlacement = fb
          break
        }
      }
    }

    // Calculate final position using the final placement
    const finalPos = positions[finalPlacement]
    finalX = finalPos.x
    finalY = finalPos.y

    // Clamp to viewport
    finalX = Math.max(PADDING, Math.min(finalX, viewportWidth - tooltipRect.width - PADDING))
    finalY = Math.max(PADDING, Math.min(finalY, viewportHeight - tooltipRect.height - PADDING))

    x.value = finalX
    y.value = finalY
    placement.value = finalPlacement
  })
}

function showTooltip(content: string, rect: DOMRect, preferredPlacement?: 'top' | 'bottom' | 'left' | 'right') {
  text.value = content
  visible.value = true
  targetRect.value = rect
  
  // Initial rough position based on preferred placement
  const initialPlacement = preferredPlacement || 'top'
  if (initialPlacement === 'right') {
    x.value = rect.right + OFFSET
    y.value = rect.top + rect.height / 2
  } else if (initialPlacement === 'left') {
    x.value = rect.left - OFFSET
    y.value = rect.top + rect.height / 2
  } else if (initialPlacement === 'bottom') {
    x.value = rect.left + rect.width / 2
    y.value = rect.bottom + OFFSET
  } else {
    x.value = rect.left + rect.width / 2
    y.value = rect.top - OFFSET
  }
  
  placement.value = initialPlacement
  
  // Calculate proper position after render
  updatePosition(rect, preferredPlacement)
}

function hideTooltip() {
  visible.value = false
  targetRect.value = null
}

// Expose methods globally
onMounted(() => {
  (window as any).__tooltip = {
    show: showTooltip,
    hide: hideTooltip
  }
})

onUnmounted(() => {
  delete (window as any).__tooltip
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-100 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        id="global-tooltip"
        class="tooltip"
        :class="[`tooltip-${placement}`]"
        :style="{ left: `${x}px`, top: `${y}px` }"
      >
        <span class="tooltip-text">{{ text }}</span>
        <div class="tooltip-arrow" :style="arrowStyle" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  max-width: 240px;
}

.tooltip-text {
  display: block;
  padding: 6px 10px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  text-align: center;
  line-height: 1.4;
}

.tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  transform: rotate(45deg);
}

/* Arrow positions - base positioning, fine-tuned by arrowStyle */
.tooltip-top .tooltip-arrow {
  bottom: -5px;
  border-top: none;
  border-left: none;
}

.tooltip-bottom .tooltip-arrow {
  top: -5px;
  border-bottom: none;
  border-right: none;
}

.tooltip-left .tooltip-arrow {
  right: -5px;
  border-bottom: none;
  border-left: none;
}

.tooltip-right .tooltip-arrow {
  left: -5px;
  border-top: none;
  border-right: none;
}

/* Dark mode adjustments - the CSS variables handle most of it */
.dark .tooltip-text {
  box-shadow: var(--shadow-lg);
}
</style>
