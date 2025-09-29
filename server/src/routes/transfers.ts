import { Router } from 'express'
import { prisma } from '../lib/db'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const transfers = await prisma.transferLink.findMany({
      include: {
        txnOut: {
          include: { account: true }
        },
        txnIn: {
          include: { account: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    res.json(transfers)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router