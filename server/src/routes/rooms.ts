import { Router } from 'express'
import { nanoid } from 'nanoid'

const router = Router()

// In-memory room storage (would be replaced with a database in production)
const rooms = new Map<string, {
  id: string
  elements: unknown[]
  createdAt: number
  updatedAt: number
}>()

// Create a new room
router.post('/', (req, res) => {
  const id = nanoid(10)
  const room = {
    id,
    elements: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  rooms.set(id, room)
  
  res.status(201).json(room)
})

// Get room by ID
router.get('/:id', (req, res) => {
  const room = rooms.get(req.params.id)
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  
  res.json(room)
})

// Update room
router.put('/:id', (req, res) => {
  const room = rooms.get(req.params.id)
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  
  const { elements } = req.body
  room.elements = elements
  room.updatedAt = Date.now()
  
  res.json(room)
})

// Delete room
router.delete('/:id', (req, res) => {
  const deleted = rooms.delete(req.params.id)
  
  if (!deleted) {
    return res.status(404).json({ error: 'Room not found' })
  }
  
  res.status(204).send()
})

// Export room as file
router.get('/:id/export', (req, res) => {
  const room = rooms.get(req.params.id)
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  
  const exportData = {
    type: 'canvara',
    version: 1,
    elements: room.elements,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }
  
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="canvara-${room.id}.json"`)
  res.json(exportData)
})

export { router as roomRoutes }

