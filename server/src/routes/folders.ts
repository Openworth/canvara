import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { authenticate, requirePaidSubscription, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

interface Folder {
  id: string
  user_id: string
  name: string
  color: string
  sort_order: number
  created_at: number
  updated_at: number
}

// All folder routes require authentication and paid subscription
router.use(authenticate)
router.use(requirePaidSubscription)

// List all folders for the user
router.get('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id

  const folders = db.prepare(`
    SELECT f.id, f.name, f.color, f.sort_order, f.created_at, f.updated_at,
           (SELECT COUNT(*) FROM projects p WHERE p.folder_id = f.id AND p.is_trashed = 0) as project_count
    FROM folders f
    WHERE f.user_id = ?
    ORDER BY f.sort_order ASC, f.created_at ASC
  `).all(userId) as Array<Folder & { project_count: number }>

  res.json({
    folders: folders.map(f => ({
      id: f.id,
      name: f.name,
      color: f.color,
      sortOrder: f.sort_order,
      projectCount: f.project_count,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))
  })
})

// Get a single folder
router.get('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const folderId = req.params.id

  const folder = db.prepare(`
    SELECT f.id, f.name, f.color, f.sort_order, f.created_at, f.updated_at,
           (SELECT COUNT(*) FROM projects p WHERE p.folder_id = f.id AND p.is_trashed = 0) as project_count
    FROM folders f
    WHERE f.id = ? AND f.user_id = ?
  `).get(folderId, userId) as (Folder & { project_count: number }) | undefined

  if (!folder) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  res.json({
    folder: {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sort_order,
      projectCount: folder.project_count,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    }
  })
})

// Create a new folder
router.post('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const { name, color } = req.body

  const folderId = nanoid()
  const now = Math.floor(Date.now() / 1000)

  // Get the max sort_order for the user's folders
  const maxOrder = db.prepare(`
    SELECT MAX(sort_order) as max_order FROM folders WHERE user_id = ?
  `).get(userId) as { max_order: number | null }
  const sortOrder = (maxOrder?.max_order ?? -1) + 1

  db.prepare(`
    INSERT INTO folders (id, user_id, name, color, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    folderId,
    userId,
    name || 'New Folder',
    color || '#6366f1',
    sortOrder,
    now,
    now
  )

  res.status(201).json({
    folder: {
      id: folderId,
      name: name || 'New Folder',
      color: color || '#6366f1',
      sortOrder,
      projectCount: 0,
      createdAt: now,
      updatedAt: now,
    }
  })
})

// Update a folder
router.put('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const folderId = req.params.id
  const { name, color, sortOrder } = req.body

  // Check if folder exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM folders WHERE id = ? AND user_id = ?
  `).get(folderId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Folder not found' })
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
  if (color !== undefined) {
    updates.push('color = ?')
    values.push(color)
  }
  if (sortOrder !== undefined) {
    updates.push('sort_order = ?')
    values.push(sortOrder)
  }

  values.push(folderId, userId)

  db.prepare(`
    UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `).run(...values)

  // Fetch updated folder
  const folder = db.prepare(`
    SELECT f.id, f.name, f.color, f.sort_order, f.created_at, f.updated_at,
           (SELECT COUNT(*) FROM projects p WHERE p.folder_id = f.id AND p.is_trashed = 0) as project_count
    FROM folders f
    WHERE f.id = ?
  `).get(folderId) as Folder & { project_count: number }

  res.json({
    folder: {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sort_order,
      projectCount: folder.project_count,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    }
  })
})

// Reorder folders (batch update sort orders)
router.put('/reorder', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const { folderIds } = req.body as { folderIds: string[] }

  if (!Array.isArray(folderIds)) {
    res.status(400).json({ error: 'folderIds must be an array' })
    return
  }

  const now = Math.floor(Date.now() / 1000)

  // Update each folder's sort_order based on its position in the array
  const updateStmt = db.prepare(`
    UPDATE folders SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `)

  db.transaction(() => {
    folderIds.forEach((folderId, index) => {
      updateStmt.run(index, now, folderId, userId)
    })
  })()

  res.json({ success: true })
})

// Delete a folder (moves projects to root)
router.delete('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const folderId = req.params.id

  // Move all projects in this folder to root (folder_id = null)
  db.prepare(`
    UPDATE projects SET folder_id = NULL WHERE folder_id = ? AND user_id = ?
  `).run(folderId, userId)

  // Delete the folder
  const result = db.prepare(`
    DELETE FROM folders WHERE id = ? AND user_id = ?
  `).run(folderId, userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  res.status(204).send()
})

export { router as folderRoutes }

