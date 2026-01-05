import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { getDb } from '../db/index.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

// Initialize Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

let stripe: Stripe | null = null

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
  })
} else {
  console.warn('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY environment variable.')
}

// Create checkout session for subscription
router.post('/checkout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!stripe || !STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Stripe not configured' })
  }

  const user = req.user!
  const db = getDb()

  try {
    // Get or create Stripe customer
    let stripeCustomerId = db.prepare(
      'SELECT stripe_customer_id FROM users WHERE id = ?'
    ).get(user.id) as { stripe_customer_id: string | null } | undefined

    let customerId = stripeCustomerId?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      })

      customerId = customer.id

      // Save customer ID to database
      db.prepare(
        'UPDATE users SET stripe_customer_id = ?, updated_at = unixepoch() WHERE id = ?'
      ).run(customerId, user.id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${CLIENT_URL}?checkout=success`,
      cancel_url: `${CLIENT_URL}?checkout=canceled`,
      metadata: {
        userId: user.id,
      },
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Failed to create checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// Get customer portal URL
router.post('/portal', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' })
  }

  const user = req.user!
  const db = getDb()

  try {
    // Get Stripe customer ID
    const userData = db.prepare(
      'SELECT stripe_customer_id FROM users WHERE id = ?'
    ).get(user.id) as { stripe_customer_id: string | null } | undefined

    if (!userData?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription' })
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: CLIENT_URL,
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Failed to create portal session:', error)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' })
  }

  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  try {
    // Verify webhook signature
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      )
    } else {
      // In development without webhook secret, parse body directly
      event = req.body as Stripe.Event
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  const db = getDb()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId

        if (userId && session.subscription) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          // Update user subscription status
          db.prepare(`
            UPDATE users 
            SET subscription_status = 'active',
                subscription_end_date = ?,
                updated_at = unixepoch()
            WHERE id = ?
          `).run(subscription.current_period_end, userId)

          console.log(`✅ Subscription activated for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by Stripe customer ID
        const user = db.prepare(
          'SELECT id FROM users WHERE stripe_customer_id = ?'
        ).get(customerId) as { id: string } | undefined

        if (user) {
          let status: string
          switch (subscription.status) {
            case 'active':
            case 'trialing':
              status = 'active'
              break
            case 'past_due':
              status = 'past_due'
              break
            case 'canceled':
            case 'unpaid':
              status = 'canceled'
              break
            default:
              status = 'free'
          }

          db.prepare(`
            UPDATE users 
            SET subscription_status = ?,
                subscription_end_date = ?,
                updated_at = unixepoch()
            WHERE id = ?
          `).run(status, subscription.current_period_end, user.id)

          console.log(`📝 Subscription updated for user ${user.id}: ${status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by Stripe customer ID
        const user = db.prepare(
          'SELECT id FROM users WHERE stripe_customer_id = ?'
        ).get(customerId) as { id: string } | undefined

        if (user) {
          db.prepare(`
            UPDATE users 
            SET subscription_status = 'canceled',
                subscription_end_date = ?,
                updated_at = unixepoch()
            WHERE id = ?
          `).run(subscription.current_period_end, user.id)

          console.log(`❌ Subscription canceled for user ${user.id}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by Stripe customer ID
        const user = db.prepare(
          'SELECT id FROM users WHERE stripe_customer_id = ?'
        ).get(customerId) as { id: string } | undefined

        if (user) {
          db.prepare(`
            UPDATE users 
            SET subscription_status = 'past_due',
                updated_at = unixepoch()
            WHERE id = ?
          `).run(user.id)

          console.log(`⚠️ Payment failed for user ${user.id}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// Get subscription status
router.get('/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!

  const now = Math.floor(Date.now() / 1000)
  const isActive = user.subscriptionStatus === 'active' ||
    (user.subscriptionStatus === 'canceled' && 
     user.subscriptionEndDate && 
     user.subscriptionEndDate > now)

  res.json({
    status: user.subscriptionStatus,
    isActive,
    endDate: user.subscriptionEndDate,
  })
})

export { router as billingRoutes }

