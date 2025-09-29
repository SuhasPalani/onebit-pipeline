import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

interface BackfillGap {
  accountId: string
  gapStart: Date
  gapEnd: Date
  expectedTxnCount: number
  actualTxnCount: number
}

export async function detectBackfillGaps(): Promise<BackfillGap[]> {
  const gaps: BackfillGap[] = []

  const accounts = await prisma.account.findMany({
    where: { isActive: true }
  })

  for (const account of accounts) {
    // Get transaction dates for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const transactions = await prisma.canonicalTransaction.findMany({
      where: {
        accountId: account.id,
        postedAt: { gte: thirtyDaysAgo }
      },
      orderBy: { postedAt: 'asc' }
    })

    // Look for gaps larger than 7 days with no transactions
    for (let i = 0; i < transactions.length - 1; i++) {
      const current = transactions[i]
      const next = transactions[i + 1]
      const daysDiff = (next.postedAt.getTime() - current.postedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff > 7) {
        gaps.push({
          accountId: account.id,
          gapStart: current.postedAt,
          gapEnd: next.postedAt,
          expectedTxnCount: Math.floor(daysDiff / 7), // Rough estimate
          actualTxnCount: 0
        })
      }
    }
  }

  if (gaps.length > 0) {
    logger.warn(`Detected ${gaps.length} potential backfill gaps:`, gaps)
  }

  return gaps
}
