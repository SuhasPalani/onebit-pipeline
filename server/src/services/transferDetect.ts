// src/services/transferDetect.ts - FINAL FIX
import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

export async function linkTransfers(accountId: string, aroundDate: Date | string, windowDays = 3) {
  // Convert to Date object if string
  const dateObj = typeof aroundDate === 'string' ? new Date(aroundDate) : aroundDate
  
  // Validate date
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    logger.error('Invalid date provided to linkTransfers:', aroundDate)
    return 0
  }

  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const start = new Date(dateObj.getTime() - windowMs)
  const end = new Date(dateObj.getTime() + windowMs)

  // Get ALL transactions in the time window (not just for specific account)
  const allTransactions = await prisma.canonicalTransaction.findMany({
    where: { 
      postedAt: { gte: start, lte: end }
    },
    orderBy: { postedAt: 'asc' }
  })

  // Separate into outgoing (negative) and incoming (positive) transactions
  const outgoingTxns = allTransactions.filter(t => Number(t.amount) < 0)
  const incomingTxns = allTransactions.filter(t => Number(t.amount) > 0)

  let linksCreated = 0

  for (const outTxn of outgoingTxns) {
    const outAmount = Math.abs(Number(outTxn.amount))
    
    // Find matching incoming transaction
    const match = incomingTxns.find(inTxn => {
      const inAmount = Number(inTxn.amount)
      const amountMatch = Math.abs(inAmount - outAmount) < 0.01 // Allow for small rounding differences
      const differentAccounts = inTxn.accountId !== outTxn.accountId
      
      return amountMatch && differentAccounts
    })
    
    if (!match) continue

    // Check if link already exists
    const existing = await prisma.transferLink.findFirst({ 
      where: { 
        txnOutId: outTxn.id, 
        txnInId: match.id 
      } 
    })
    
    if (existing) continue

    // Create the transfer link
    await prisma.transferLink.create({
      data: {
        txnOutId: outTxn.id,
        txnInId: match.id,
        detectionMethod: 'amount+time',
        confidence: 0.9,
        windowSec: windowDays * 86400
      }
    })

    linksCreated++
    logger.info(`🔗 Linked transfer: ${outTxn.id} (${outTxn.amount}) -> ${match.id} (${match.amount})`)
  }

  logger.info(`Transfer detection completed. Created ${linksCreated} links in ${windowDays}-day window around ${dateObj.toISOString()}`)
  return linksCreated
}