import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './websocket/handler.js'
import { roomRoutes } from './routes/rooms.js'

const app = express()
const server = createServer(app)

// CORS configuration for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Room routes
app.use('/api/rooms', roomRoutes)

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' })
setupWebSocket(wss)

// Start server
const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`)
})

