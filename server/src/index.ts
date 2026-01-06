import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './websocket/handler.js'
import { roomRoutes } from './routes/rooms.js'
import { authRoutes } from './routes/auth.js'
import { projectRoutes } from './routes/projects.js'
import { billingRoutes } from './routes/billing.js'
import { imageRoutes } from './routes/images.js'
import { visualizeRoutes } from './routes/visualize.js'
import { getDb } from './db/index.js'

const app = express()
const server = createServer(app)

// Initialize database
getDb()

// CORS configuration for production
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// Support multiple origins (www and non-www)
const allowedOrigins = [
  CLIENT_URL,
  // Add www variant if not localhost
  CLIENT_URL.includes('localhost') ? null : CLIENT_URL.replace('https://', 'https://www.'),
  // Add non-www variant if it has www
  CLIENT_URL.startsWith('https://www.') ? CLIENT_URL.replace('https://www.', 'https://') : null,
].filter(Boolean) as string[]

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true)
      return
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.log(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`)
      callback(null, false)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}

// Middleware
app.use(cors(corsOptions))
app.use(cookieParser())

// Raw body for Stripe webhooks
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))

// JSON body for other routes
app.use(express.json({ limit: '50mb' })) // Increased for project data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(passport.initialize() as any)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/images', imageRoutes)
app.use('/api/visualize', visualizeRoutes)

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' })
setupWebSocket(wss)

// Start server
const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}/ws`)
})

