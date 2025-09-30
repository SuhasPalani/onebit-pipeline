import { Router } from 'express'
import { prisma } from '../lib/db'
import { z } from 'zod'
import { accountCacheMiddleware, invalidateAccountCache } from '../middleware/cache'

const router = Router()

const accountSchema = z.object({
  user_id: z.string(),
  provider_id: z.string(),
  institution_id: z.string(),
  account_type: z.string(),
  currency: z.string().default('USD'),
  mask: z.string().optional(),
  display_name: z.string().optional()
})

// Create account
router.post('/', async (req, res) => {
  try {
    const data = accountSchema.parse(req.body)
    
    const account = await prisma.account.create({
      data: {
        userId: data.user_id,
        providerId: data.provider_id,
        institutionId: data.institution_id,
        accountType: data.account_type,
        currency: data.currency,
        mask: data.mask,
        displayName: data.display_name
      }
    })

    // Invalidate list cache
    await invalidateAccountCache('list')

    res.json(account)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Get all accounts (with caching)
router.get('/', accountCacheMiddleware, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        provider: true,
        _count: {
          select: {
            canonicalTxns: true,
            rawTransactions: true
          }
        }
      }
    })
    res.json(accounts)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Get single account (with caching)
router.get('/:id', accountCacheMiddleware, async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
      include: {
        provider: true,
        canonicalTxns: {
          orderBy: { postedAt: 'desc' },
          take: 50,
          include: {
            classification: {
              include: { category: true }
            }
          }
        }
      }
    })
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' })
    }
    
    res.json(account)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Update account
router.patch('/:id', async (req, res) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: req.body
    })

    // Invalidate cache
    await invalidateAccountCache(req.params.id)

    res.json(account)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    await prisma.account.delete({
      where: { id: req.params.id }
    })

    // Invalidate cache
    await invalidateAccountCache(req.params.id)

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router