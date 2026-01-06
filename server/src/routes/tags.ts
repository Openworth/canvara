import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { authenticate, requirePaidSubscription, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: number
}

// All tag routes require authentication and paid subscription
router.use(authenticate)
router.use(requirePaidSubscription)

// List all tags for the user
router.get('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id

  const tags = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at,
           (SELECT COUNT(*) FROM project_tags pt 
            JOIN projects p ON p.id = pt.project_id 
            WHERE pt.tag_id = t.id AND p.is_trashed = 0) as project_count
    FROM tags t
    WHERE t.user_id = ?
    ORDER BY t.name ASC
  `).all(userId) as Array<Tag & { project_count: number }>

  res.json({
    tags: tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      projectCount: t.project_count,
      createdAt: t.created_at,
    }))
  })
})

// Get a single tag
router.get('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const tagId = req.params.id

  const tag = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at,
           (SELECT COUNT(*) FROM project_tags pt 
            JOIN projects p ON p.id = pt.project_id 
            WHERE pt.tag_id = t.id AND p.is_trashed = 0) as project_count
    FROM tags t
    WHERE t.id = ? AND t.user_id = ?
  `).get(tagId, userId) as (Tag & { project_count: number }) | undefined

  if (!tag) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  res.json({
    tag: {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      projectCount: tag.project_count,
      createdAt: tag.created_at,
    }
  })
})

// Create a new tag
router.post('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const { name, color } = req.body

  if (!name?.trim()) {
    res.status(400).json({ error: 'Tag name is required' })
    return
  }

  // Check for duplicate tag name (case-insensitive)
  const existing = db.prepare(`
    SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `).get(userId, name.trim())

  if (existing) {
    res.status(409).json({ error: 'A tag with this name already exists' })
    return
  }

  const tagId = nanoid()
  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    INSERT INTO tags (id, user_id, name, color, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    tagId,
    userId,
    name.trim(),
    color || '#6366f1',
    now
  )

  res.status(201).json({
    tag: {
      id: tagId,
      name: name.trim(),
      color: color || '#6366f1',
      projectCount: 0,
      createdAt: now,
    }
  })
})

// Update a tag
router.put('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const tagId = req.params.id
  const { name, color } = req.body

  // Check if tag exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM tags WHERE id = ? AND user_id = ?
  `).get(tagId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  // If name is being changed, check for duplicates
  if (name !== undefined) {
    const duplicate = db.prepare(`
      SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id != ?
    `).get(userId, name.trim(), tagId)

    if (duplicate) {
      res.status(409).json({ error: 'A tag with this name already exists' })
      return
    }
  }

  // Build update query dynamically based on provided fields
  const updates: string[] = []
  const values: (string | number)[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name.trim())
  }
  if (color !== undefined) {
    updates.push('color = ?')
    values.push(color)
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  values.push(tagId, userId)

  db.prepare(`
    UPDATE tags SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `).run(...values)

  // Fetch updated tag
  const tag = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at,
           (SELECT COUNT(*) FROM project_tags pt 
            JOIN projects p ON p.id = pt.project_id 
            WHERE pt.tag_id = t.id AND p.is_trashed = 0) as project_count
    FROM tags t
    WHERE t.id = ?
  `).get(tagId) as Tag & { project_count: number }

  res.json({
    tag: {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      projectCount: tag.project_count,
      createdAt: tag.created_at,
    }
  })
})

// Delete a tag (removes from all projects)
router.delete('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const tagId = req.params.id

  // Delete the tag (cascade will remove project_tags entries)
  const result = db.prepare(`
    DELETE FROM tags WHERE id = ? AND user_id = ?
  `).run(tagId, userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  res.status(204).send()
})

export { router as tagRoutes }

