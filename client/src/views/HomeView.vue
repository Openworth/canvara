<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCanvasStore } from '../stores/canvas'
import { useCollaborationStore } from '../stores/collaboration'
import CanvasContainer from '../components/canvas/CanvasContainer.vue'
import Toolbar from '../components/toolbar/Toolbar.vue'
import Sidebar from '../components/sidebar/Sidebar.vue'
import LibraryPanel from '../components/sidebar/LibraryPanel.vue'
import TopBar from '../components/ui/TopBar.vue'
import ZoomControls from '../components/ui/ZoomControls.vue'

const route = useRoute()
const canvasStore = useCanvasStore()
const collaborationStore = useCollaborationStore()

onMounted(() => {
  const roomId = route.params.roomId as string | undefined
  console.log('[DEBUG] HomeView mounted, roomId:', roomId)
  
  if (roomId) {
    collaborationStore.joinRoom(roomId)
  }
  
  // Load saved canvas state if no room
  if (!roomId) {
    console.log('[DEBUG] No roomId, calling loadFromLocalStorage')
    canvasStore.loadFromLocalStorage()
    console.log('[DEBUG] After loadFromLocalStorage, elements count:', canvasStore.elements.length)
  }
  
  // On mobile, default to pan tool for better touch experience
  const isMobile = window.innerWidth < 768
  if (isMobile) {
    canvasStore.setActiveTool('hand')
  }
})

onUnmounted(() => {
  collaborationStore.leaveRoom()
})
</script>

<template>
  <div 
    class="relative w-full h-full overflow-hidden"
    :style="{ backgroundColor: canvasStore.appState.viewBackgroundColor }"
  >
    <!-- Top bar with menu and share -->
    <TopBar />
    
    <!-- Main toolbar (left side) -->
    <Toolbar />
    
    <!-- Canvas -->
    <CanvasContainer />
    
    <!-- Right sidebar (properties) -->
    <Sidebar />
    
    <!-- Library panel -->
    <LibraryPanel />
    
    <!-- Zoom controls (bottom right) -->
    <ZoomControls />
  </div>
</template>

