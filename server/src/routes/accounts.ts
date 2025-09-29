import { Router } from 'express'
import { prisma } from '../lib/db'
import { z } from 'zod'

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

    res.json(account)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

router.get('/', async (req, res) => {
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

router.get('/:id', async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
      include: {
        provider: true,
        canonicalTxns: {
          orderBy: { postedAt: 'desc' },
          take: 50
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

export default router