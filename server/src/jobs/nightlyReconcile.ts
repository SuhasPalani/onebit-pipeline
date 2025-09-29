import { prisma } from '../lib/db'
import { reconcileAccount } from '../services/reconcile'
import { logger } from '../lib/logger'

export async function nightlyReconcileJob() {
  logger.info('Starting nightly reconciliation job')

  const accounts = await prisma.account.findMany({
    where: { isActive: true }
  })

  const results = []

  for (const account of accounts) {
    try {
      const result = await reconcileAccount(account.id)
      results.push({ accountId: account.id, status: result.status, delta: result.delta })
    } catch (error) {
      logger.error(`Reconciliation failed for account ${account.id}:`, error)
      results.push({ accountId: account.id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  logger.info(`Nightly reconciliation completed. Results:`, results)
  return results
}