import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { authenticate, requirePaidSubscription, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

interface Project {
  id: string
  user_id: string
  name: string
  elements: string
  app_state: string | null
  thumbnail: string | null
  created_at: number
  updated_at: number
}

// All project routes require authentication and paid subscription
router.use(authenticate)
router.use(requirePaidSubscription)

// Helper to detect if a color is dark
function isColorDark(color: string): boolean {
  if (!color) return false
  const darkColors = ['#121212', '#1e1e1e', '#000000', '#000', '#0a0a0a', '#171717']
  const lowerColor = color.toLowerCase()
  if (darkColors.includes(lowerColor)) return true
  
  let hex = color.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length !== 6) return false
  
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}

// List all projects for the user
router.get('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id

  const projects = db.prepare(`
    SELECT id, name, thumbnail, app_state, created_at, updated_at
    FROM projects
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId) as Pick<Project, 'id' | 'name' | 'thumbnail' | 'app_state' | 'created_at' | 'updated_at'>[]

  res.json({ 
    projects: projects.map(p => {
      // Extract theme from app_state
      let isDarkTheme = false
      if (p.app_state) {
        try {
          const appState = JSON.parse(p.app_state)
          isDarkTheme = isColorDark(appState.viewBackgroundColor || '#ffffff')
        } catch {}
      }
      return {
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail,
        isDarkTheme,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })
  })
})

// Get a single project
router.get('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  const project = db.prepare(`
    SELECT * FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId) as Project | undefined

  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  res.json({
    project: {
      id: project.id,
      name: project.name,
      elements: JSON.parse(project.elements),
      appState: project.app_state ? JSON.parse(project.app_state) : null,
      thumbnail: project.thumbnail,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }
  })
})

// Create a new project
router.post('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const { name, elements, appState, thumbnail } = req.body

  const projectId = nanoid()
  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    INSERT INTO projects (id, user_id, name, elements, app_state, thumbnail, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    userId,
    name || 'Untitled',
    JSON.stringify(elements || []),
    appState ? JSON.stringify(appState) : null,
    thumbnail || null,
    now,
    now
  )

  res.status(201).json({
    project: {
      id: projectId,
      name: name || 'Untitled',
      elements: elements || [],
      appState: appState || null,
      thumbnail: thumbnail || null,
      createdAt: now,
      updatedAt: now,
    }
  })
})

// Update a project
router.put('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id
  const { name, elements, appState, thumbnail } = req.body

  // Check if project exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const now = Math.floor(Date.now() / 1000)

  // Build update query dynamically based on provided fields
  const updates: string[] = ['updated_at = ?']
  const values: (string | number | null)[] = [now]

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (elements !== undefined) {
    updates.push('elements = ?')
    values.push(JSON.stringify(elements))
  }
  if (appState !== undefined) {
    updates.push('app_state = ?')
    values.push(appState ? JSON.stringify(appState) : null)
  }
  if (thumbnail !== undefined) {
    updates.push('thumbnail = ?')
    values.push(thumbnail)
  }

  values.push(projectId, userId)

  db.prepare(`
    UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `).run(...values)

  // Fetch updated project
  const project = db.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).get(projectId) as Project

  res.json({
    project: {
      id: project.id,
      name: project.name,
      elements: JSON.parse(project.elements),
      appState: project.app_state ? JSON.parse(project.app_state) : null,
      thumbnail: project.thumbnail,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }
  })
})

// Delete a project
router.delete('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  const result = db.prepare(`
    DELETE FROM projects WHERE id = ? AND user_id = ?
  `).run(projectId, userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  res.status(204).send()
})

// Duplicate a project
router.post('/:id/duplicate', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const sourceProjectId = req.params.id

  // Get source project
  const source = db.prepare(`
    SELECT * FROM projects WHERE id = ? AND user_id = ?
  `).get(sourceProjectId, userId) as Project | undefined

  if (!source) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const newId = nanoid()
  const now = Math.floor(Date.now() / 1000)
  const newName = `${source.name} (copy)`

  db.prepare(`
    INSERT INTO projects (id, user_id, name, elements, app_state, thumbnail, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    userId,
    newName,
    source.elements,
    source.app_state,
    source.thumbnail,
    now,
    now
  )

  res.status(201).json({
    project: {
      id: newId,
      name: newName,
      elements: JSON.parse(source.elements),
      appState: source.app_state ? JSON.parse(source.app_state) : null,
      thumbnail: source.thumbnail,
      createdAt: now,
      updatedAt: now,
    }
  })
})

export { router as projectRoutes }

