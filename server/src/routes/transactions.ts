import { Router } from 'express'
import { prisma } from '../lib/db'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { account_id, limit = 50, offset = 0 } = req.query
    
    const where = account_id ? { accountId: account_id as string } : {}
    
    const transactions = await prisma.canonicalTransaction.findMany({
      where,
      include: {
        account: true,
        transfersOut: true,
        transfersIn: true,
        classification: {
          include: { category: true }
        },
        ledgerEntries: true
      },
      orderBy: { postedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    })
    
    res.json(transactions)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const transaction = await prisma.canonicalTransaction.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        transfersOut: true,
        transfersIn: true,
        classification: {
          include: { category: true }
        },
        ledgerEntries: true
      }
    })
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }
    
    res.json(transaction)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router