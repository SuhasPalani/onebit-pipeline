import { prisma } from '../lib/db'
import { logger } from '../lib/logger'
import { normalizeMerchant } from './normalizeMerchant'

export async function normalizeRaw(raw: any) {
  const postedAt = raw.timestampPosted || raw.timestampAuth || new Date()
  const desc = raw.descriptionRaw || ''
  const norm = normalizeMerchant(desc)

  const groupKey = raw.providerTxId || 
    `${norm.name}|${new Date(postedAt).toISOString().slice(0, 10)}|${Math.abs(Number(raw.amount)).toFixed(2)}`

  const existingId = await maybeFindCanonicalId(raw.accountId, groupKey, raw.amount, postedAt)

  const ct = await prisma.canonicalTransaction.upsert({
    where: { id: existingId || '00000000-0000-0000-0000-000000000000' },
    create: {
      groupKey,
      accountId: raw.accountId,
      postedAt,
      amount: raw.amount,
      descriptionNorm: norm.name,
      counterpartyNorm: norm.counterparty,
      txType: inferType(raw),
      rawIds: [raw.id]
    },
    update: {
      postedAt,
      amount: raw.amount,
      descriptionNorm: norm.name,
      counterpartyNorm: norm.counterparty,
      rawIds: { push: raw.id }
    }
  })

  logger.info(`Normalized transaction ${raw.id} -> ${ct.id}`)
  return ct
}

function inferType(raw: any): string {
  if (/FEE|INTEREST/i.test(raw.descriptionRaw)) return 'fee'
  return Number(raw.amount) < 0 ? 'debit' : 'credit'
}

async function maybeFindCanonicalId(accountId: string, groupKey: string, amount: any, postedAt: Date) {
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const found = await prisma.canonicalTransaction.findFirst({
    where: {
      accountId,
      groupKey,
      amount: amount,
      postedAt: { 
        gte: new Date(postedAt.getTime() - threeDaysMs), 
        lte: new Date(postedAt.getTime() + threeDaysMs) 
      }
    },
    select: { id: true }
  })
  return found?.id
}