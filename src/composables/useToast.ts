import { ref } from 'vue'

export interface ToastMessage {
  id: number
  text: string
  type?: 'success' | 'info' | 'error'
}

const toasts = ref<ToastMessage[]>([])
let nextId = 0

export function useToast() {
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success', duration = 2600) => {
    const id = ++nextId
    toasts.value.push({ id, text, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  const copyToClipboard = async (text: string, successMessage = '¡Copiado al portapapeles!') => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(successMessage, 'success')
    } catch {
      showToast('No se pudo copiar al portapapeles', 'error')
    }
  }

  return {
    toasts,
    showToast,
    copyToClipboard
  }
}
