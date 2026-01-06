import { onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../stores/canvas'
import { useLibraryStore } from '../stores/library'

export function useKeyboardShortcuts() {
  const canvasStore = useCanvasStore()
  const libraryStore = useLibraryStore()

  function handleKeyDown(e: KeyboardEvent) {
    // Don't handle if typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? e.metaKey : e.ctrlKey

    // Mod + key shortcuts
    if (modKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          if (e.shiftKey) {
            canvasStore.redo()
          } else {
            canvasStore.undo()
          }
          e.preventDefault()
          break
        case 'y':
          canvasStore.redo()
          e.preventDefault()
          break
        case 'a':
          canvasStore.selectAll()
          e.preventDefault()
          break
        case 'c':
          canvasStore.copySelectedElements()
          e.preventDefault()
          break
        case 'x':
          canvasStore.copySelectedElements()
          canvasStore.deleteSelectedElements()
          e.preventDefault()
          break
        case 'v':
          canvasStore.pasteElements()
          e.preventDefault()
          break
        case 'd':
          canvasStore.duplicateSelectedElements()
          e.preventDefault()
          break
        case 'g':
          if (e.shiftKey) {
            // Ungroup - not implemented yet
          } else {
            canvasStore.toggleGrid()
          }
          e.preventDefault()
          break
        case '0':
          canvasStore.resetZoom()
          e.preventDefault()
          break
        case '=':
        case '+':
          canvasStore.zoomIn()
          e.preventDefault()
          break
        case '-':
          canvasStore.zoomOut()
          e.preventDefault()
          break
        case 's':
          // Save - already auto-saves
          e.preventDefault()
          break
        case 'l':
          libraryStore.toggleLibrary()
          e.preventDefault()
          break
      }
      return
    }

    // Single key shortcuts (no modifier)
    switch (e.key) {
      case '1':
      case 'v':
      case 'V':
        canvasStore.setActiveTool('selection')
        break
      case '2':
      case 'r':
      case 'R':
        canvasStore.setActiveTool('rectangle')
        break
      case '3':
      case 'o':
      case 'O':
        canvasStore.setActiveTool('ellipse')
        break
      case '4':
      case 'd':
      case 'D':
        canvasStore.setActiveTool('diamond')
        break
      case '5':
      case 'a':
      case 'A':
        canvasStore.setActiveTool('arrow')
        break
      case '6':
      case 'l':
      case 'L':
        canvasStore.setActiveTool('line')
        break
      case '7':
      case 'p':
      case 'P':
        canvasStore.setActiveTool('freedraw')
        break
      case '8':
      case 't':
      case 'T':
        canvasStore.setActiveTool('text')
        break
      case '9':
      case 'i':
      case 'I':
        // Dispatch event to open image picker (handled by Toolbar)
        window.dispatchEvent(new CustomEvent('open-image-picker'))
        break
      case 'e':
      case 'E':
        canvasStore.setActiveTool('eraser')
        break
      case 'h':
      case 'H':
        canvasStore.setActiveTool('hand')
        break
      case 'Delete':
      case 'Backspace':
        canvasStore.deleteSelectedElements()
        break
      case 'Escape':
        canvasStore.clearSelection()
        canvasStore.setActiveTool('selection')
        libraryStore.closeLibrary()
        break
      case '[':
        if (canvasStore.selectedElementIds.size > 0) {
          canvasStore.sendBackward([...canvasStore.selectedElementIds])
        }
        break
      case ']':
        if (canvasStore.selectedElementIds.size > 0) {
          canvasStore.bringForward([...canvasStore.selectedElementIds])
        }
        break
      case '{':
        if (canvasStore.selectedElementIds.size > 0) {
          canvasStore.sendToBack([...canvasStore.selectedElementIds])
        }
        break
      case '}':
        if (canvasStore.selectedElementIds.size > 0) {
          canvasStore.bringToFront([...canvasStore.selectedElementIds])
        }
        break
      case '?':
        window.dispatchEvent(new CustomEvent('toggle-keyboard-shortcuts'))
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}

