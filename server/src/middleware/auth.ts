import { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/index.js'

// Hardcoded admin accounts with permanent pro access
const ADMIN_EMAILS = ['yurlovandrew@gmail.com']

export interface JwtPayload {
  userId: string
  email: string
}

export interface UserData {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  subscriptionStatus: string
  subscriptionEndDate: number | null
  isAdmin: boolean
}

export interface AuthenticatedRequest extends Request {
  user?: UserData
}

// Helper to check if email is an admin
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
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

// Helper to extract token from Authorization header or cookie
function extractToken(req: Request): string | null {
  // First try Authorization header (preferred)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  // Fallback to cookie for backwards compatibility
  return req.cookies?.auth_token || null
}

// Middleware to authenticate user from JWT token
export const authenticate: RequestHandler = (req, res, next) => {
  const token = extractToken(req)

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
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
    res.status(401).json({ error: 'User not found' })
    return
  }

  const isAdmin = isAdminEmail(user.email)

  ;(req as AuthenticatedRequest).user = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    // Admins always have active subscription
    subscriptionStatus: isAdmin ? 'active' : user.subscription_status,
    subscriptionEndDate: user.subscription_end_date,
    isAdmin,
  }

  next()
}

// Middleware to require paid subscription
export const requirePaidSubscription: RequestHandler = (req, res, next) => {
  const authReq = req as AuthenticatedRequest
  
  if (!authReq.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const { subscriptionStatus, subscriptionEndDate } = authReq.user
  const now = Math.floor(Date.now() / 1000)

  // Check if subscription is active
  const isActive = subscriptionStatus === 'active' || 
    (subscriptionStatus === 'canceled' && subscriptionEndDate && subscriptionEndDate > now)

  if (!isActive) {
    res.status(403).json({ 
      error: 'Paid subscription required',
      subscriptionStatus,
    })
    return
  }

  next()
}

// Optional authentication - doesn't fail if not authenticated
export const optionalAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req)

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
        const isAdmin = isAdminEmail(user.email)
        ;(req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          // Admins always have active subscription
          subscriptionStatus: isAdmin ? 'active' : user.subscription_status,
          subscriptionEndDate: user.subscription_end_date,
          isAdmin,
        }
      }
    }
  }

  next()
}
