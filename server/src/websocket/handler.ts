import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager, type Room } from '../rooms/RoomManager.js'

interface WSMessage {
  type: 'join' | 'leave' | 'update' | 'cursor' | 'selection' | 'sync' | 'user-joined' | 'user-left' | 'error'
  roomId: string
  userId: string
  payload: unknown
}

interface JoinPayload {
  username: string
  elements?: unknown[]
}

interface Collaborator {
  userId: string
  username: string
  color: string
  cursor: { x: number; y: number } | null
  selectedElementIds: string[]
}

interface ClientInfo {
  userId: string
  roomId: string | null
  ws: WebSocket
  collaborator: Collaborator
}

const COLORS = [
  '#e03131', '#c2255c', '#9c36b5', '#6741d9', '#3b5bdb',
  '#1971c2', '#0c8599', '#099268', '#2f9e44', '#66a80f',
  '#f08c00', '#e8590c',
]

export function setupWebSocket(wss: WebSocketServer) {
  const clients = new Map<WebSocket, ClientInfo>()
  const roomManager = new RoomManager()

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection')

    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString())
        handleMessage(ws, message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
        sendError(ws, 'Invalid message format')
      }
    })

    ws.on('close', () => {
      handleDisconnect(ws)
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })

  function handleMessage(ws: WebSocket, message: WSMessage) {
    switch (message.type) {
      case 'join':
        handleJoin(ws, message)
        break
      case 'leave':
        handleLeave(ws, message)
        break
      case 'update':
        handleUpdate(ws, message)
        break
      case 'cursor':
        handleCursor(ws, message)
        break
      case 'selection':
        handleSelection(ws, message)
        break
      default:
        sendError(ws, `Unknown message type: ${message.type}`)
    }
  }

  function handleJoin(ws: WebSocket, message: WSMessage) {
    const { roomId, userId, payload } = message
    const { username, elements: incomingElements } = payload as JoinPayload

    // Create or get room
    let room = roomManager.getRoom(roomId)
    const isNewRoom = !room
    if (!room) {
      room = roomManager.createRoom(roomId)
    }

    // If user brings elements and room is new or empty, add them to room
    if (incomingElements && incomingElements.length > 0) {
      const elementMap = new Map(room.elements.map((el: any) => [el.id, el]))
      incomingElements.forEach((el: any) => {
        // Add new elements or update if version is higher
        const existing = elementMap.get(el.id)
        if (!existing || el.version > existing.version) {
          elementMap.set(el.id, el)
        }
      })
      room.elements = Array.from(elementMap.values())
      room.updatedAt = Date.now()

      // Broadcast the new elements to existing room members
      if (!isNewRoom) {
        broadcastToRoom(roomId, {
          type: 'update',
          roomId,
          userId,
          payload: { elements: incomingElements },
        }, ws)
      }
    }

    // Create collaborator info
    const colorIndex = room.collaborators.size % COLORS.length
    const collaborator: Collaborator = {
      userId: userId,
      username: username || `User ${Math.floor(Math.random() * 1000)}`,
      color: COLORS[colorIndex],
      cursor: null,
      selectedElementIds: [],
    }

    // Store client info
    clients.set(ws, {
      userId: userId,
      roomId,
      ws,
      collaborator,
    })

    // Add to room
    room.collaborators.set(userId, collaborator)

    // Send sync message with current state (including any elements the user brought)
    sendMessage(ws, {
      type: 'sync',
      roomId,
      userId,
      payload: {
        elements: room.elements,
        collaborators: Array.from(room.collaborators.values()),
      },
    })

    // Notify others in the room
    broadcastToRoom(roomId, {
      type: 'user-joined',
      roomId,
      userId,
      payload: collaborator,
    }, ws)

    console.log(`User ${username} joined room ${roomId} with ${incomingElements?.length || 0} elements`)
  }

  function handleLeave(ws: WebSocket, message: WSMessage) {
    const clientInfo = clients.get(ws)
    if (!clientInfo) return

    const { roomId, userId } = message

    // Remove from room
    const room = roomManager.getRoom(roomId)
    if (room) {
      room.collaborators.delete(userId)
      
      // Notify others
      broadcastToRoom(roomId, {
        type: 'user-left',
        roomId,
        userId,
        payload: null,
      }, ws)

      // Clean up empty rooms after a delay
      if (room.collaborators.size === 0) {
        setTimeout(() => {
          const currentRoom = roomManager.getRoom(roomId)
          if (currentRoom && currentRoom.collaborators.size === 0) {
            roomManager.deleteRoom(roomId)
            console.log(`Room ${roomId} deleted (empty)`)
          }
        }, 60000) // 1 minute
      }
    }

    // Clear client info
    clientInfo.roomId = null
    console.log(`User ${userId} left room ${roomId}`)
  }

  function handleUpdate(ws: WebSocket, message: WSMessage) {
    const clientInfo = clients.get(ws)
    if (!clientInfo || !clientInfo.roomId) return

    const { roomId, payload } = message
    const { elements } = payload as { elements: unknown[] }

    // Update room state
    const room = roomManager.getRoom(roomId)
    if (room) {
      // Merge elements
      const elementMap = new Map(room.elements.map((el: any) => [el.id, el]))
      elements.forEach((el: any) => {
        const existing = elementMap.get(el.id)
        if (!existing || el.version > existing.version) {
          elementMap.set(el.id, el)
        }
      })
      room.elements = Array.from(elementMap.values())
      room.updatedAt = Date.now()
    }

    // Broadcast to other clients in the room
    broadcastToRoom(roomId, message, ws)
  }

  function handleCursor(ws: WebSocket, message: WSMessage) {
    const clientInfo = clients.get(ws)
    if (!clientInfo || !clientInfo.roomId) return

    const { roomId, userId, payload } = message
    const { cursor } = payload as { cursor: { x: number; y: number } | null }

    // Update collaborator cursor
    const room = roomManager.getRoom(roomId)
    if (room) {
      const collab = room.collaborators.get(userId)
      if (collab) {
        collab.cursor = cursor
      }
    }

    // Broadcast to other clients
    broadcastToRoom(roomId, message, ws)
  }

  function handleSelection(ws: WebSocket, message: WSMessage) {
    const clientInfo = clients.get(ws)
    if (!clientInfo || !clientInfo.roomId) return

    const { roomId, userId, payload } = message
    const { selectedElementIds } = payload as { selectedElementIds: string[] }

    // Update collaborator selection
    const room = roomManager.getRoom(roomId)
    if (room) {
      const collab = room.collaborators.get(userId)
      if (collab) {
        collab.selectedElementIds = selectedElementIds
      }
    }

    // Broadcast to other clients
    broadcastToRoom(roomId, message, ws)
  }

  function handleDisconnect(ws: WebSocket) {
    const clientInfo = clients.get(ws)
    if (!clientInfo) return

    if (clientInfo.roomId) {
      handleLeave(ws, {
        type: 'leave',
        roomId: clientInfo.roomId,
        userId: clientInfo.userId,
        payload: null,
      })
    }

    clients.delete(ws)
    console.log('WebSocket disconnected')
  }

  function sendMessage(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  function sendError(ws: WebSocket, error: string) {
    sendMessage(ws, {
      type: 'sync', // Using sync type for error response
      roomId: '',
      userId: '',
      payload: { error },
    })
  }

  function broadcastToRoom(roomId: string, message: WSMessage, excludeWs?: WebSocket) {
    clients.forEach((clientInfo, ws) => {
      if (clientInfo.roomId === roomId && ws !== excludeWs) {
        sendMessage(ws, message)
      }
    })
  }
}

