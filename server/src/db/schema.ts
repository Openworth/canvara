import type Database from 'better-sqlite3'

export function initializeSchema(db: Database.Database): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      stripe_customer_id TEXT,
      subscription_status TEXT DEFAULT 'free',
      subscription_end_date INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Folders table - single-level folder organization for projects
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'New Folder',
      color TEXT NOT NULL DEFAULT '#6366f1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT 'Untitled',
      elements TEXT NOT NULL DEFAULT '[]',
      app_state TEXT,
      thumbnail TEXT,
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      is_trashed INTEGER NOT NULL DEFAULT 0,
      trashed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Tags table - colored labels for project organization
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Project-Tags junction table (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_tags (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, tag_id)
    )
  `)

  // Magic Notes usage tracking for free tier (3 uses per day)
  db.exec(`
    CREATE TABLE IF NOT EXISTS magic_notes_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      used_at INTEGER DEFAULT (unixepoch())
    )
  `)

  // Add new columns to existing projects table (for migrations)
  const addColumnIfNotExists = (table: string, column: string, definition: string) => {
    try {
      const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      const columnExists = tableInfo.some(col => col.name === column)
      if (!columnExists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
        console.log(`✅ Added column ${column} to ${table}`)
      }
    } catch (e) {
      // Column might already exist or table doesn't exist yet
    }
  }

  // Migrate existing projects table if needed
  addColumnIfNotExists('projects', 'folder_id', 'TEXT REFERENCES folders(id) ON DELETE SET NULL')
  addColumnIfNotExists('projects', 'is_starred', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfNotExists('projects', 'is_archived', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfNotExists('projects', 'is_trashed', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfNotExists('projects', 'trashed_at', 'INTEGER')

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects(folder_id);
    CREATE INDEX IF NOT EXISTS idx_projects_is_starred ON projects(is_starred);
    CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived);
    CREATE INDEX IF NOT EXISTS idx_projects_is_trashed ON projects(is_trashed);
    CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_magic_notes_usage_user_id ON magic_notes_usage(user_id);
    CREATE INDEX IF NOT EXISTS idx_magic_notes_usage_used_at ON magic_notes_usage(used_at);
  `)

  console.log('✅ Database schema initialized')
}

