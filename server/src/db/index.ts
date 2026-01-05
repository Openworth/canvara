import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { initializeSchema } from './schema.js'

// Use persistent volume path in production, local path in development
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/data/canvara.db'
  : path.join(process.cwd(), 'data', 'canvara.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    
    initializeSchema(db)
    console.log(`📦 Database connected at ${DB_PATH}`)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    console.log('📦 Database connection closed')
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb()
  process.exit(0)
})

process.on('SIGTERM', () => {
  closeDb()
  process.exit(0)
})

