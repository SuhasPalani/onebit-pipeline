import { Router } from 'express'
import { prisma } from '../lib/db'
import { reconcileAccount } from '../services/reconcile'
import { uuidSchema, paginationSchema } from '../lib/validation'
import { logger } from '../lib/logger'

const router = Router()

// Get reconciliation runs for an account
router.get('/account/:accountId', async (req, res) => {
  try {
    const accountId = uuidSchema.parse(req.params.accountId)
    const { limit, offset } = paginationSchema.parse(req.query)

    const reconciliations = await prisma.reconciliationRun.findMany({
      where: { accountId },
      include: { account: true },
      orderBy: { asOfDate: 'desc' },
      take: limit,
      skip: offset
    })

    res.json(reconciliations)
  } catch (error) {
    logger.error('Error fetching reconciliations:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Trigger reconciliation for specific account
router.post('/account/:accountId', async (req, res) => {
  try {
    const accountId = uuidSchema.parse(req.params.accountId)
    const asOfDate = req.body.as_of_date ? new Date(req.body.as_of_date) : new Date()

    const result = await reconcileAccount(accountId, asOfDate)
    
    res.json({
      ok: true,
      reconciliation: result
    })
  } catch (error) {
    logger.error('Error running reconciliation:', error)
    res.status(500).json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Get all recent reconciliation runs
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query)

    const reconciliations = await prisma.reconciliationRun.findMany({
      include: { 
        account: {
          select: {
            displayName: true,
            accountType: true,
            currency: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    res.json(reconciliations)
  } catch (error) {
    logger.error('Error fetching reconciliations:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Get reconciliation summary stats
router.get('/summary', async (req, res) => {
  try {
    const stats = await prisma.reconciliationRun.aggregate({
      _count: { id: true },
      _avg: { delta: true },
      _sum: { delta: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    })

    const statusBreakdown = await prisma.reconciliationRun.groupBy({
      by: ['status'],
      _count: { status: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    res.json({
      totalRuns: stats._count.id,
      averageDelta: stats._avg.delta,
      totalDelta: stats._sum.delta,
      statusBreakdown
    })
  } catch (error) {
    logger.error('Error fetching reconciliation summary:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router