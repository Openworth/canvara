import { Router, Request, Response } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { generateToken, authenticate, isAdminEmail, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// Configure Google OAuth strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/api/auth/google/callback`,
  }, (accessToken, refreshToken, profile, done) => {
    try {
      const db = getDb()
      const googleId = profile.id
      const email = profile.emails?.[0]?.value || ''
      const name = profile.displayName || ''
      const avatarUrl = profile.photos?.[0]?.value || null

      // Find or create user
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as {
        id: string
        google_id: string
        email: string
        name: string | null
        avatar_url: string | null
        subscription_status: string
      } | undefined

      if (!user) {
        // Create new user
        const userId = nanoid()
        db.prepare(`
          INSERT INTO users (id, google_id, email, name, avatar_url)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, googleId, email, name, avatarUrl)

        user = {
          id: userId,
          google_id: googleId,
          email,
          name,
          avatar_url: avatarUrl,
          subscription_status: 'free',
        }
      } else {
        // Update existing user's profile info
        db.prepare(`
          UPDATE users SET email = ?, name = ?, avatar_url = ?, updated_at = unixepoch()
          WHERE id = ?
        `).run(email, name, avatarUrl, user.id)
      }

      done(null, user)
    } catch (error) {
      done(error as Error)
    }
  }))
} else {
  console.warn('⚠️  Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
}

// Initialize passport (no session)
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user as Express.User))

// Initiate Google OAuth
router.get('/google', (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth not configured' })
  }
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next)
})

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${CLIENT_URL}?error=auth_failed`,
  }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string } | undefined
    
    if (!user) {
      return res.redirect(`${CLIENT_URL}?error=auth_failed`)
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email })

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    // Redirect to client
    res.redirect(`${CLIENT_URL}?auth=success`)
  }
)

// Get current user
router.get('/me', authenticate, (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  res.json({ user: authReq.user })
})

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  })
  res.json({ success: true })
})

// Check auth status (doesn't require auth, just returns status)
router.get('/status', (req: Request, res: Response): void => {
  const token = req.cookies?.auth_token
  
  if (!token) {
    res.json({ authenticated: false })
    return
  }

  // Import dynamically to avoid circular dependency
  import('../middleware/auth.js').then(({ verifyToken }) => {
    const payload = verifyToken(token)
    if (!payload) {
      res.json({ authenticated: false })
      return
    }

    const db = getDb()
    const user = db.prepare(`
      SELECT id, email, name, avatar_url, subscription_status, subscription_end_date
      FROM users WHERE id = ?
    `).get(payload.userId) as {
      id: string
      email: string
      name: string | null
      avatar_url: string | null
      subscription_status: string
      subscription_end_date: number | null
    } | undefined

    if (!user) {
      res.json({ authenticated: false })
      return
    }

    const isAdmin = isAdminEmail(user.email)
    
    res.json({ 
      authenticated: true, 
      user: {
        ...user,
        // Admins always have active subscription
        subscription_status: isAdmin ? 'active' : user.subscription_status,
        is_admin: isAdmin,
      }
    })
  })
})

export { router as authRoutes }

