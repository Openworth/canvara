import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/index.js'

export interface JwtPayload {
  userId: string
  email: string
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    subscriptionStatus: string
    subscriptionEndDate: number | null
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

// Middleware to authenticate user from JWT cookie
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Get user from database
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
    return res.status(401).json({ error: 'User not found' })
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    subscriptionStatus: user.subscription_status,
    subscriptionEndDate: user.subscription_end_date,
  }

  next()
}

// Middleware to require paid subscription
export function requirePaidSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { subscriptionStatus, subscriptionEndDate } = req.user
  const now = Math.floor(Date.now() / 1000)

  // Check if subscription is active
  const isActive = subscriptionStatus === 'active' || 
    (subscriptionStatus === 'canceled' && subscriptionEndDate && subscriptionEndDate > now)

  if (!isActive) {
    return res.status(403).json({ 
      error: 'Paid subscription required',
      subscriptionStatus,
    })
  }

  next()
}

// Optional authentication - doesn't fail if not authenticated
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token

  if (token) {
    const payload = verifyToken(token)
    if (payload) {
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

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          subscriptionStatus: user.subscription_status,
          subscriptionEndDate: user.subscription_end_date,
        }
      }
    }
  }

  next()
}

