export interface Collaborator {
  userId: string
  username: string
  color: string
  cursor: { x: number; y: number } | null
  selectedElementIds: string[]
}

export interface Room {
  id: string
  elements: unknown[]
  collaborators: Map<string, Collaborator>
  createdAt: number
  updatedAt: number
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map()

  createRoom(id: string): Room {
    const room: Room = {
      id,
      elements: [],
      collaborators: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.rooms.set(id, room)
    console.log(`Room created: ${id}`)
    return room
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id)
  }

  deleteRoom(id: string): boolean {
    return this.rooms.delete(id)
  }

  getRoomCount(): number {
    return this.rooms.size
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  // Export room data for persistence
  exportRoom(id: string): object | null {
    const room = this.rooms.get(id)
    if (!room) return null

    return {
      id: room.id,
      elements: room.elements,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }
  }

  // Import room data
  importRoom(data: {
    id: string
    elements: unknown[]
    createdAt: number
    updatedAt: number
  }): Room {
    const room: Room = {
      ...data,
      collaborators: new Map(),
    }
    this.rooms.set(data.id, room)
    return room
  }

  // Clean up old empty rooms
  cleanupEmptyRooms(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    this.rooms.forEach((room, id) => {
      if (room.collaborators.size === 0 && now - room.updatedAt > maxAgeMs) {
        this.rooms.delete(id)
        cleaned++
      }
    })

    return cleaned
  }
}

