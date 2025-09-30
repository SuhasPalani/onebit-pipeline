import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

export async function reconcileAccount(accountId: string, asOfDate: Date = new Date()) {
  const account = await prisma.account.findUnique({
    where: { id: accountId }
  })

  if (!account) throw new Error('Account not found')

  // Calculate system balance from ledger entries
  const cashGL = `Asset:Cash:${account.displayName || account.id}`
  
  const ledgerBalance = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: {
      glAccount: cashGL,
      createdAt: { lte: asOfDate }
    }
  })

  const systemBalance = Number(ledgerBalance._sum.amount || 0)

  // For demo purposes, simulate institution balance
  // In real implementation, this would come from provider API
  const institutionBalance = systemBalance + (Math.random() - 0.5) * 10 // Add small random drift

  const delta = round2(systemBalance - institutionBalance)
  const status = Math.abs(delta) <= 1.0 ? 'ok' : 'drift'

  const dateStr = asOfDate.toISOString().split('T')[0]

  const reconciliation = await prisma.reconciliationRun.upsert({
    where: {
      accountId_asOfDate: {
        accountId,
        asOfDate: new Date(dateStr)
      }
    },
    create: {
      accountId,
      asOfDate: new Date(dateStr),
      systemBalance,
      institutionBalance,
      delta,
      status
    },
    update: {
      systemBalance,
      institutionBalance,
      delta,
      status
    }
  })

  if (status === 'drift') {
    logger.warn(`Account ${accountId} has reconciliation drift: $${delta}`)
  } else {
    logger.info(`Account ${accountId} reconciled successfully`)
  }

  return reconciliation
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}