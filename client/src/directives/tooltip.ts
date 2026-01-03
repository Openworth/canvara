import type { Directive, DirectiveBinding } from 'vue'

export interface TooltipBinding {
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

type TooltipValue = string | TooltipBinding

// Store handlers so we can clean them up
const handlerMap = new WeakMap<HTMLElement, {
  show: () => void
  hide: () => void
}>()

function getContent(binding: DirectiveBinding<TooltipValue>): string {
  if (typeof binding.value === 'string') {
    return binding.value
  }
  return binding.value?.content ?? ''
}

function getPlacement(binding: DirectiveBinding<TooltipValue>): 'top' | 'bottom' | 'left' | 'right' {
  if (typeof binding.value === 'object' && binding.value?.placement) {
    return binding.value.placement
  }
  // Check modifiers
  if (binding.modifiers.bottom) return 'bottom'
  if (binding.modifiers.left) return 'left'
  if (binding.modifiers.right) return 'right'
  return 'top' // default
}

function showTooltip(el: HTMLElement, binding: DirectiveBinding<TooltipValue>) {
  const tooltip = (window as any).__tooltip
  if (!tooltip) return

  const content = getContent(binding)
  if (!content) return

  const rect = el.getBoundingClientRect()
  const placement = getPlacement(binding)
  tooltip.show(content, rect, placement)
}

function hideTooltip() {
  const tooltip = (window as any).__tooltip
  if (tooltip) {
    tooltip.hide()
  }
}

export const vTooltip: Directive<HTMLElement, TooltipValue> = {
  mounted(el, binding) {
    if (!binding.value) return

    const showHandler = () => showTooltip(el, binding)
    const hideHandler = () => hideTooltip()

    el.addEventListener('mouseenter', showHandler)
    el.addEventListener('mouseleave', hideHandler)
    el.addEventListener('focus', showHandler)
    el.addEventListener('blur', hideHandler)
    // Hide on click (user is interacting, tooltip is no longer needed)
    el.addEventListener('mousedown', hideHandler)

    handlerMap.set(el, { show: showHandler, hide: hideHandler })
  },

  updated(el, binding) {
    // Update handlers with new binding values
    const handlers = handlerMap.get(el)
    if (!handlers) return

    // Remove old handlers
    el.removeEventListener('mouseenter', handlers.show)
    el.removeEventListener('mouseleave', handlers.hide)
    el.removeEventListener('focus', handlers.show)
    el.removeEventListener('blur', handlers.hide)
    el.removeEventListener('mousedown', handlers.hide)

    if (!binding.value) {
      handlerMap.delete(el)
      return
    }

    // Add new handlers
    const showHandler = () => showTooltip(el, binding)
    const hideHandler = () => hideTooltip()

    el.addEventListener('mouseenter', showHandler)
    el.addEventListener('mouseleave', hideHandler)
    el.addEventListener('focus', showHandler)
    el.addEventListener('blur', hideHandler)
    el.addEventListener('mousedown', hideHandler)

    handlerMap.set(el, { show: showHandler, hide: hideHandler })
  },

  unmounted(el) {
    const handlers = handlerMap.get(el)
    if (!handlers) return

    el.removeEventListener('mouseenter', handlers.show)
    el.removeEventListener('mouseleave', handlers.hide)
    el.removeEventListener('focus', handlers.show)
    el.removeEventListener('blur', handlers.hide)
    el.removeEventListener('mousedown', handlers.hide)

    handlerMap.delete(el)
  }
}

export default vTooltip

