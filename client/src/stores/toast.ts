import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastMessage {
  id: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastMessage[]>([])

  function show(message: string, type: ToastMessage['type'] = 'info', duration = 3000) {
    const id = Date.now().toString()
    toasts.value.push({ id, message, type, duration })

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(message: string, duration = 3000) {
    show(message, 'success', duration)
  }

  function error(message: string, duration = 5000) {
    show(message, 'error', duration)
  }

  function info(message: string, duration = 3000) {
    show(message, 'info', duration)
  }

  function warning(message: string, duration = 4000) {
    show(message, 'warning', duration)
  }

  return {
    toasts,
    show,
    remove,
    success,
    error,
    info,
    warning,
  }
})

