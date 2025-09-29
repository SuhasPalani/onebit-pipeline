import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

export async function postToLedger(txnId: string) {
  const txn = await prisma.canonicalTransaction.findUnique({ 
    where: { id: txnId },
    include: { account: true }
  })
  
  if (!txn) return

  // Remove existing entries for idempotent re-posting
  await prisma.ledgerEntry.deleteMany({ where: { txnId } })

  const account = txn.account
  const isCreditCard = /credit_card/i.test(account.accountType)
  const amount = Number(txn.amount)

  if (isCreditCard) {
    if (amount < 0) {
      // Purchase on credit card
      const expenseGl = await mapToExpenseGL(txnId)
      await prisma.ledgerEntry.createMany({
        data: [
          {
            txnId,
            lineNo: 1,
            glAccount: expenseGl,
            amount: Math.abs(amount),
            sign: 'debit'
          },
          {
            txnId,
            lineNo: 2,
            glAccount: `Liability:CreditCard:${account.displayName || account.id}`,
            amount: Math.abs(amount),
            sign: 'credit'
          }
        ]
      })
    } else {
      // Credit card payment/refund
      await prisma.ledgerEntry.createMany({
        data: [
          {
            txnId,
            lineNo: 1,
            glAccount: `Liability:CreditCard:${account.displayName || account.id}`,
            amount: amount,
            sign: 'debit'
          },
          {
            txnId,
            lineNo: 2,
            glAccount: 'Revenue:Refunds',
            amount: amount,
            sign: 'credit'
          }
        ]
      })
    }
  } else {
    // Bank account
    if (amount < 0) {
      // Money leaving bank
      const transfer = await prisma.transferLink.findFirst({ where: { txnOutId: txnId } })
      if (transfer) {
        // Transfer out - only credit cash (the inbound leg will debit destination)
        await prisma.ledgerEntry.create({
          data: {
            txnId,
            lineNo: 1,
            glAccount: `Asset:Cash:${account.displayName || account.id}`,
            amount: Math.abs(amount),
            sign: 'credit'
          }
        })
      } else {
        // Expense
        const expenseGl = await mapToExpenseGL(txnId)
        await prisma.ledgerEntry.createMany({
          data: [
            {
              txnId,
              lineNo: 1,
              glAccount: expenseGl,
              amount: Math.abs(amount),
              sign: 'debit'
            },
            {
              txnId,
              lineNo: 2,
              glAccount: `Asset:Cash:${account.displayName || account.id}`,
              amount: Math.abs(amount),
              sign: 'credit'
            }
          ]
        })
      }
    } else {
      // Money incoming to bank
      const transfer = await prisma.transferLink.findFirst({ where: { txnInId: txnId } })
      if (transfer) {
        // Transfer in
        await prisma.ledgerEntry.create({
          data: {
            txnId,
            lineNo: 1,
            glAccount: `Asset:Cash:${account.displayName || account.id}`,
            amount: amount,
            sign: 'debit'
          }
        })
      } else {
        // Revenue
        await prisma.ledgerEntry.createMany({
          data: [
            {
              txnId,
              lineNo: 1,
              glAccount: `Asset:Cash:${account.displayName || account.id}`,
              amount: amount,
              sign: 'debit'
            },
            {
              txnId,
              lineNo: 2,
              glAccount: 'Revenue:Uncategorized',
              amount: amount,
              sign: 'credit'
            }
          ]
        })
      }
    }
  }

  logger.info(`Posted ledger entries for transaction ${txnId}`)
}

async function mapToExpenseGL(txnId: string): Promise<string> {
  const classification = await prisma.classification.findUnique({ 
    where: { txnId },
    include: { category: true }
  })
  
  if (classification?.category) {
    return `Expense:${classification.category.name}`
  }
  
  return 'Expense:Uncategorized'
}
