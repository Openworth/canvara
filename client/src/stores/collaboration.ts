import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { useCanvasStore } from './canvas'
import { useAppStore } from './app'
import type { Collaborator, Point, ExcalidrawElement, WSMessage } from '../types'

const COLORS = [
  '#e03131', '#c2255c', '#9c36b5', '#6741d9', '#3b5bdb',
  '#1971c2', '#0c8599', '#099268', '#2f9e44', '#66a80f',
  '#f08c00', '#e8590c',
]

export const useCollaborationStore = defineStore('collaboration', () => {
  const canvasStore = useCanvasStore()
  const appStore = useAppStore()
  
  // WebSocket connection
  const ws = ref<WebSocket | null>(null)
  
  // Current room
  const roomId = ref<string | null>(null)
  
  // Current user
  const userId = ref(nanoid())
  const username = ref(`User ${Math.floor(Math.random() * 1000)}`)
  const userColor = ref(COLORS[Math.floor(Math.random() * COLORS.length)])
  
  // Collaborators in the room
  const collaborators = ref<Map<string, Collaborator>>(new Map())
  
  // Reconnection state
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 1000
  
  // Cursor throttle - using requestAnimationFrame for smooth updates
  let cursorThrottleTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingCursor: Point | null = null
  const cursorThrottleMs = 16 // ~60fps for smooth cursor updates
  
  // Computed
  const isConnected = computed(() => ws.value?.readyState === WebSocket.OPEN)
  const collaboratorList = computed(() => Array.from(collaborators.value.values()))
  
  // Track if this is the room creator (has existing elements to share)
  const isRoomCreator = ref(false)
  const pendingElements = ref<ExcalidrawElement[]>([])

  // Get WebSocket URL (production uses env var, dev uses same host)
  function getWsUrl(): string {
    const wsUrl = import.meta.env.VITE_WS_URL
    if (wsUrl) {
      return wsUrl
    }
    // Development: use same host with proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }

  // Connect to WebSocket server
  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) return
    
    appStore.setConnectionStatus('connecting')
    
    ws.value = new WebSocket(getWsUrl())
    
    ws.value.onopen = () => {
      appStore.setConnectionStatus('connected')
      reconnectAttempts.value = 0
      
      if (roomId.value) {
        // If creator has elements, send them with the join message
        const elementsToShare = isRoomCreator.value ? pendingElements.value : []
        
        sendMessage({
          type: 'join',
          roomId: roomId.value,
          userId: userId.value,
          payload: { 
            username: username.value,
            elements: elementsToShare,
          },
        })
      }
    }
    
    ws.value.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }
    
    ws.value.onclose = () => {
      appStore.setConnectionStatus('disconnected')
      
      // Attempt to reconnect
      if (reconnectAttempts.value < maxReconnectAttempts && roomId.value) {
        reconnectAttempts.value++
        setTimeout(() => {
          if (roomId.value) {
            connect()
          }
        }, reconnectDelay * reconnectAttempts.value)
      }
    }
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }
  
  // Handle incoming messages
  function handleMessage(message: WSMessage) {    
    switch (message.type) {
      case 'sync': {
        const payload = message.payload as {
          elements: ExcalidrawElement[]
          collaborators: Collaborator[]
        }
        
        // Track if this is a join (not creator) to center on host cursor
        const isJoiningAsGuest = !isRoomCreator.value
        
        // If room creator, merge server elements with our existing elements
        // Otherwise, just set the elements from server
        if (isRoomCreator.value && pendingElements.value.length > 0) {
          // Merge: our elements take precedence since we just sent them
          const serverElements = payload.elements || []
          const mergedMap = new Map<string, ExcalidrawElement>()
          
          // Add server elements first
          serverElements.forEach(el => mergedMap.set(el.id, el))
          // Our elements override
          pendingElements.value.forEach(el => mergedMap.set(el.id, el))
          
          canvasStore.setElements(Array.from(mergedMap.values()))
          isRoomCreator.value = false
          pendingElements.value = []
        } else {
          canvasStore.setElements(payload.elements || [])
        }
        
        // Set collaborators, excluding self
        const collabMap = new Map<string, Collaborator>()
        payload.collaborators.forEach(c => {
          if (c.userId !== userId.value) {
            collabMap.set(c.userId, c)
          }
        })
        collaborators.value = collabMap
        
        // If joining as guest (user B), center on content or host's cursor
        if (isJoiningAsGuest) {
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          
          if (payload.elements && payload.elements.length > 0) {
            // Center on the content if there are elements
            canvasStore.centerOnContent(viewportWidth, viewportHeight)
          } else {
            // No content - center on the host's cursor if available
            const hostWithCursor = payload.collaborators.find(
              c => c.userId !== userId.value && c.cursor
            )
            
            if (hostWithCursor?.cursor) {
              canvasStore.centerOnPoint(
                hostWithCursor.cursor.x,
                hostWithCursor.cursor.y,
                viewportWidth,
                viewportHeight
              )
            }
          }
        }
        break
      }
      
      case 'update': {
        const payload = message.payload as { elements: ExcalidrawElement[] }
        canvasStore.mergeElements(payload.elements)
        break
      }
      
      case 'cursor': {
        const payload = message.payload as { cursor: Point | null }
        const collab = collaborators.value.get(message.userId)
        if (collab) {
          collab.cursor = payload.cursor
          collaborators.value = new Map(collaborators.value)
        }
        break
      }
      
      case 'selection': {
        const payload = message.payload as { selectedElementIds: string[] }
        const collab = collaborators.value.get(message.userId)
        if (collab) {
          collab.selectedElementIds = payload.selectedElementIds
          collaborators.value = new Map(collaborators.value)
        }
        break
      }
      
      case 'user-joined': {
        const payload = message.payload as Collaborator
        if (payload.userId !== userId.value) {
          collaborators.value.set(payload.userId, payload)
          collaborators.value = new Map(collaborators.value)
        }
        break
      }
      
      case 'user-left': {
        collaborators.value.delete(message.userId)
        collaborators.value = new Map(collaborators.value)
        break
      }
      
      case 'error': {
        console.error('Server error:', message.payload)
        break
      }
    }
  }
  
  // Send message to server
  function sendMessage(message: WSMessage) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message))
    }
  }
  
  // Join a room
  function joinRoom(newRoomId: string) {
    roomId.value = newRoomId
    connect()
  }
  
  // Leave current room
  function leaveRoom() {
    if (roomId.value && ws.value) {
      sendMessage({
        type: 'leave',
        roomId: roomId.value,
        userId: userId.value,
        payload: null,
      })
    }
    
    roomId.value = null
    collaborators.value = new Map()
    
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
  }
  
  // Broadcast element updates
  function broadcastUpdate(elements: ExcalidrawElement[]) {
    if (!roomId.value || !isConnected.value) return
    
    sendMessage({
      type: 'update',
      roomId: roomId.value,
      userId: userId.value,
      payload: { elements },
    })
  }
  
  // Broadcast cursor position (throttled)
  function broadcastCursor(cursor: Point | null) {
    if (!roomId.value || !isConnected.value) return
    
    // Always store the latest cursor position
    pendingCursor = cursor
    
    // If already waiting, the latest position will be sent when timer fires
    if (cursorThrottleTimeout) return
    
    cursorThrottleTimeout = setTimeout(() => {
      // Send the most recent cursor position
      sendMessage({
        type: 'cursor',
        roomId: roomId.value!,
        userId: userId.value,
        payload: { cursor: pendingCursor },
      })
      cursorThrottleTimeout = null
    }, cursorThrottleMs)
  }
  
  // Broadcast selection changes
  function broadcastSelection(selectedElementIds: string[]) {
    if (!roomId.value || !isConnected.value) return
    
    sendMessage({
      type: 'selection',
      roomId: roomId.value,
      userId: userId.value,
      payload: { selectedElementIds },
    })
  }
  
  // Set username
  function setUsername(name: string) {
    username.value = name
  }
  
  // Create a new room and return the ID
  async function createRoom(): Promise<string> {
    const newRoomId = nanoid(10)
    
    // Save current elements to share with the room
    isRoomCreator.value = true
    pendingElements.value = [...canvasStore.elements]
    
    joinRoom(newRoomId)
    return newRoomId
  }
  
  // Get shareable link
  function getShareableLink(): string {
    if (!roomId.value) return window.location.origin
    return `${window.location.origin}/${roomId.value}`
  }
  
  return {
    // State
    roomId,
    userId,
    username,
    userColor,
    collaborators,
    
    // Computed
    isConnected,
    collaboratorList,
    
    // Actions
    connect,
    joinRoom,
    leaveRoom,
    broadcastUpdate,
    broadcastCursor,
    broadcastSelection,
    setUsername,
    createRoom,
    getShareableLink,
  }
})

