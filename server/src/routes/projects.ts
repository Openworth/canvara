import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { authenticate, requirePaidSubscription, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

interface Project {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  elements: string
  app_state: string | null
  thumbnail: string | null
  is_starred: number
  is_archived: number
  is_trashed: number
  trashed_at: number | null
  created_at: number
  updated_at: number
}

interface Tag {
  id: string
  name: string
  color: string
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

// Helper to get tags for a project
function getProjectTags(db: ReturnType<typeof getDb>, projectId: string): Tag[] {
  return db.prepare(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN project_tags pt ON pt.tag_id = t.id
    WHERE pt.project_id = ?
    ORDER BY t.name ASC
  `).all(projectId) as Tag[]
}

// Helper to format project for response
function formatProjectListItem(p: Project & { app_state?: string | null }, tags: Tag[]) {
  let isDarkTheme = false
  if (p.app_state) {
    try {
      const appState = JSON.parse(p.app_state)
      isDarkTheme = isColorDark(appState.viewBackgroundColor || '#ffffff')
    } catch { /* ignore */ }
  }
  return {
    id: p.id,
    name: p.name,
    thumbnail: p.thumbnail,
    isDarkTheme,
    folderId: p.folder_id,
    isStarred: Boolean(p.is_starred),
    isArchived: Boolean(p.is_archived),
    isTrashed: Boolean(p.is_trashed),
    trashedAt: p.trashed_at,
    tags,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

// List all projects for the user with filtering and sorting
router.get('/', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id

  // Query parameters
  const {
    folder,
    starred,
    archived,
    trashed,
    tags: tagIds,
    search,
    sort = 'updatedAt',
    order = 'desc',
    recent,
  } = req.query

  // Build WHERE conditions
  const conditions: string[] = ['p.user_id = ?']
  const values: (string | number)[] = [userId]

  // By default, don't show trashed or archived projects unless specifically requested
  if (trashed === 'true') {
    conditions.push('p.is_trashed = 1')
  } else if (archived === 'true') {
    conditions.push('p.is_archived = 1')
    conditions.push('p.is_trashed = 0')
  } else {
    conditions.push('p.is_trashed = 0')
    conditions.push('p.is_archived = 0')
  }

  // Filter by folder
  if (folder !== undefined) {
    if (folder === 'null' || folder === '') {
      conditions.push('p.folder_id IS NULL')
    } else {
      conditions.push('p.folder_id = ?')
      values.push(folder as string)
    }
  }

  // Filter by starred
  if (starred === 'true') {
    conditions.push('p.is_starred = 1')
  }

  // Filter by tags (comma-separated)
  if (tagIds && typeof tagIds === 'string') {
    const tagIdArray = tagIds.split(',').filter(Boolean)
    if (tagIdArray.length > 0) {
      conditions.push(`p.id IN (
        SELECT pt.project_id FROM project_tags pt 
        WHERE pt.tag_id IN (${tagIdArray.map(() => '?').join(',')})
        GROUP BY pt.project_id
        HAVING COUNT(DISTINCT pt.tag_id) = ?
      )`)
      values.push(...tagIdArray, tagIdArray.length)
    }
  }

  // Search by name
  if (search && typeof search === 'string') {
    conditions.push('p.name LIKE ?')
    values.push(`%${search}%`)
  }

  // Recent projects (last 7 days)
  if (recent === 'true') {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
    conditions.push('p.updated_at >= ?')
    values.push(sevenDaysAgo)
  }

  // Sort order
  const sortMap: Record<string, string> = {
    name: 'p.name',
    createdAt: 'p.created_at',
    updatedAt: 'p.updated_at',
  }
  const sortColumn = sortMap[sort as string] || 'p.updated_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

  const projects = db.prepare(`
    SELECT p.id, p.name, p.thumbnail, p.app_state, p.folder_id,
           p.is_starred, p.is_archived, p.is_trashed, p.trashed_at,
           p.created_at, p.updated_at
    FROM projects p
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${sortColumn} ${sortOrder}
  `).all(...values) as Project[]

  // Get tags for each project
  const projectsWithTags = projects.map(p => {
    const tags = getProjectTags(db, p.id)
    return formatProjectListItem(p, tags)
  })

  res.json({ projects: projectsWithTags })
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

  const tags = getProjectTags(db, projectId)

  res.json({
    project: {
      id: project.id,
      name: project.name,
      elements: JSON.parse(project.elements),
      appState: project.app_state ? JSON.parse(project.app_state) : null,
      thumbnail: project.thumbnail,
      folderId: project.folder_id,
      isStarred: Boolean(project.is_starred),
      isArchived: Boolean(project.is_archived),
      isTrashed: Boolean(project.is_trashed),
      trashedAt: project.trashed_at,
      tags,
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
  const { name, elements, appState, thumbnail, folderId } = req.body

  // Validate folder belongs to user if provided
  if (folderId) {
    const folder = db.prepare(`
      SELECT id FROM folders WHERE id = ? AND user_id = ?
    `).get(folderId, userId)
    if (!folder) {
      res.status(400).json({ error: 'Invalid folder' })
      return
    }
  }

  const projectId = nanoid()
  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    INSERT INTO projects (id, user_id, folder_id, name, elements, app_state, thumbnail, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    userId,
    folderId || null,
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
      folderId: folderId || null,
      isStarred: false,
      isArchived: false,
      isTrashed: false,
      trashedAt: null,
      tags: [],
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

  const tags = getProjectTags(db, projectId)

  res.json({
    project: {
      id: project.id,
      name: project.name,
      elements: JSON.parse(project.elements),
      appState: project.app_state ? JSON.parse(project.app_state) : null,
      thumbnail: project.thumbnail,
      folderId: project.folder_id,
      isStarred: Boolean(project.is_starred),
      isArchived: Boolean(project.is_archived),
      isTrashed: Boolean(project.is_trashed),
      trashedAt: project.trashed_at,
      tags,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }
  })
})

// Move project to folder
router.put('/:id/move', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id
  const { folderId } = req.body

  // Check if project exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  // Validate folder if provided
  if (folderId) {
    const folder = db.prepare(`
      SELECT id FROM folders WHERE id = ? AND user_id = ?
    `).get(folderId, userId)
    if (!folder) {
      res.status(400).json({ error: 'Invalid folder' })
      return
    }
  }

  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    UPDATE projects SET folder_id = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(folderId || null, now, projectId, userId)

  res.json({ success: true, folderId: folderId || null })
})

// Toggle starred status
router.post('/:id/star', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  // Get current status
  const project = db.prepare(`
    SELECT is_starred FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId) as { is_starred: number } | undefined

  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const newStatus = project.is_starred ? 0 : 1
  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    UPDATE projects SET is_starred = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(newStatus, now, projectId, userId)

  res.json({ success: true, isStarred: Boolean(newStatus) })
})

// Toggle archived status
router.post('/:id/archive', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  // Get current status
  const project = db.prepare(`
    SELECT is_archived FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId) as { is_archived: number } | undefined

  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const newStatus = project.is_archived ? 0 : 1
  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    UPDATE projects SET is_archived = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(newStatus, now, projectId, userId)

  res.json({ success: true, isArchived: Boolean(newStatus) })
})

// Move to trash
router.post('/:id/trash', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    UPDATE projects SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(now, now, projectId, userId)

  res.json({ success: true, isTrashed: true, trashedAt: now })
})

// Restore from trash
router.post('/:id/restore', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  const now = Math.floor(Date.now() / 1000)

  db.prepare(`
    UPDATE projects SET is_trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?
  `).run(now, projectId, userId)

  res.json({ success: true, isTrashed: false })
})

// Permanently delete a project
router.delete('/:id/permanent', (req: Request, res: Response): void => {
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

// Delete a project (soft delete - move to trash)
router.delete('/:id', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id

  const existing = db.prepare(`
    SELECT id, is_trashed FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId) as { id: string; is_trashed: number } | undefined

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  // If already in trash, permanently delete
  if (existing.is_trashed) {
    db.prepare(`
      DELETE FROM projects WHERE id = ? AND user_id = ?
    `).run(projectId, userId)
  } else {
    // Move to trash
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`
      UPDATE projects SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND user_id = ?
    `).run(now, now, projectId, userId)
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
    INSERT INTO projects (id, user_id, folder_id, name, elements, app_state, thumbnail, is_starred, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    newId,
    userId,
    source.folder_id,
    newName,
    source.elements,
    source.app_state,
    source.thumbnail,
    now,
    now
  )

  // Copy tags
  const sourceTags = getProjectTags(db, sourceProjectId)
  const insertTag = db.prepare(`
    INSERT INTO project_tags (project_id, tag_id) VALUES (?, ?)
  `)
  sourceTags.forEach(tag => {
    insertTag.run(newId, tag.id)
  })

  res.status(201).json({
    project: {
      id: newId,
      name: newName,
      elements: JSON.parse(source.elements),
      appState: source.app_state ? JSON.parse(source.app_state) : null,
      thumbnail: source.thumbnail,
      folderId: source.folder_id,
      isStarred: false,
      isArchived: false,
      isTrashed: false,
      trashedAt: null,
      tags: sourceTags,
      createdAt: now,
      updatedAt: now,
    }
  })
})

// Add tags to a project
router.post('/:id/tags', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id
  const { tagIds } = req.body as { tagIds: string[] }

  // Check if project exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  if (!Array.isArray(tagIds)) {
    res.status(400).json({ error: 'tagIds must be an array' })
    return
  }

  // Validate all tags belong to user
  const validTags = db.prepare(`
    SELECT id FROM tags WHERE user_id = ? AND id IN (${tagIds.map(() => '?').join(',')})
  `).all(userId, ...tagIds) as { id: string }[]

  const validTagIds = new Set(validTags.map(t => t.id))

  // Insert tags (ignore duplicates)
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)
  `)

  tagIds.forEach(tagId => {
    if (validTagIds.has(tagId)) {
      insertStmt.run(projectId, tagId)
    }
  })

  const now = Math.floor(Date.now() / 1000)
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, projectId)

  // Return updated tags
  const tags = getProjectTags(db, projectId)
  res.json({ success: true, tags })
})

// Remove a tag from a project
router.delete('/:id/tags/:tagId', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id
  const projectId = req.params.id
  const tagId = req.params.tagId

  // Check if project exists and belongs to user
  const existing = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND user_id = ?
  `).get(projectId, userId)

  if (!existing) {
    res.status(404).json({ error: 'Project not found' })
    return
  }

  db.prepare(`
    DELETE FROM project_tags WHERE project_id = ? AND tag_id = ?
  `).run(projectId, tagId)

  const now = Math.floor(Date.now() / 1000)
  db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now, projectId)

  // Return updated tags
  const tags = getProjectTags(db, projectId)
  res.json({ success: true, tags })
})

// Empty trash (delete all trashed projects)
router.delete('/trash/empty', (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const db = getDb()
  const userId = authReq.user!.id

  const result = db.prepare(`
    DELETE FROM projects WHERE user_id = ? AND is_trashed = 1
  `).run(userId)

  res.json({ success: true, deletedCount: result.changes })
})

export { router as projectRoutes }
