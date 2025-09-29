import { prisma } from '../lib/db'
import { linkTransfers } from '../services/transferDetect'
import { logger } from '../lib/logger'

export async function runTransferDetectionJob() {
  logger.info('Starting transfer detection job')
  
  const lookbackDays = 7
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays)

  try {
    // Get all accounts with recent transactions
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        canonicalTxns: {
          some: {
            postedAt: { gte: lookbackDate }
          }
        }
      }
    })

    let totalLinksCreated = 0

    for (const account of accounts) {
      // Get recent transactions for this account
      const recentTransactions = await prisma.canonicalTransaction.findMany({
        where: {
          accountId: account.id,
          postedAt: { gte: lookbackDate }
        },
        orderBy: { postedAt: 'desc' }
      })

      // Run transfer detection for each transaction's date
      for (const txn of recentTransactions) {
        const linksCreated = await linkTransfers(account.id, txn.postedAt)
        totalLinksCreated += linksCreated
      }
    }

    logger.info(`Transfer detection job completed. Created ${totalLinksCreated} new transfer links`)
    
    return {
      accountsProcessed: accounts.length,
      linksCreated: totalLinksCreated,
      lookbackDays
    }
  } catch (error) {
    logger.error('Transfer detection job failed:', error)
    throw error
  }
}