import { Router, Request, Response, RequestHandler } from 'express'
import { nanoid } from 'nanoid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const router = Router()

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const IMAGES_DIR = path.join(__dirname, '../../data/images')

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

// File extension mapping
const EXTENSION_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

// Configure multer for memory storage (we'll save with custom filename)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`))
    }
  },
})

// Upload image
router.post('/', upload.single('image') as unknown as RequestHandler, (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' })
      return
    }

    const fileId = nanoid()
    const extension = EXTENSION_MAP[req.file.mimetype] || '.png'
    const filename = `${fileId}${extension}`
    const filepath = path.join(IMAGES_DIR, filename)

    // Write file to disk
    fs.writeFileSync(filepath, req.file.buffer)

    // Return the file ID and URL
    const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    
    res.status(201).json({
      fileId,
      url: `${baseUrl}/api/images/${fileId}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
  } catch (error) {
    console.error('Error uploading image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// Get image by fileId
router.get('/:fileId', (req: Request, res: Response): void => {
  try {
    const { fileId } = req.params

    // Find the file (we don't know the extension)
    const files = fs.readdirSync(IMAGES_DIR)
    const matchingFile = files.find(f => f.startsWith(fileId))

    if (!matchingFile) {
      res.status(404).json({ error: 'Image not found' })
      return
    }

    const filepath = path.join(IMAGES_DIR, matchingFile)
    const extension = path.extname(matchingFile).toLowerCase()

    // Set content type based on extension
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    }

    const contentType = contentTypeMap[extension] || 'application/octet-stream'
    
    // Set cache headers (images are immutable once uploaded)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    
    // Stream the file
    const fileStream = fs.createReadStream(filepath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Error serving image:', error)
    res.status(500).json({ error: 'Failed to serve image' })
  }
})

// Delete image by fileId (optional, for cleanup)
router.delete('/:fileId', (req: Request, res: Response): void => {
  try {
    const { fileId } = req.params

    const files = fs.readdirSync(IMAGES_DIR)
    const matchingFile = files.find(f => f.startsWith(fileId))

    if (!matchingFile) {
      res.status(404).json({ error: 'Image not found' })
      return
    }

    const filepath = path.join(IMAGES_DIR, matchingFile)
    fs.unlinkSync(filepath)

    res.status(204).send()
  } catch (error) {
    console.error('Error deleting image:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

export { router as imageRoutes }

