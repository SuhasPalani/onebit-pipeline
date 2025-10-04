import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { stableHashV1 } from '../lib/hash'
import { normalizeRaw } from '../services/normalize'
import { linkTransfers } from '../services/transferDetect'
import { postToLedger } from '../services/ledger'
import { classifyTransaction } from '../services/classify'
import { logger } from '../lib/logger'
import type { IngestRequest, IngestResult } from '../types'

const router = Router()

const transactionSchema = z.object({
  provider_tx_id: z.string().optional(),
  timestamp_posted: z.string().optional(),
  timestamp_auth: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('USD'),
  description_raw: z.string(),
  counterparty_raw: z.string().optional(),
  balance_after: z.number().optional(),
  meta_json: z.any().default({})
})

const ingestSchema = z.object({
  transactions: z.array(transactionSchema)
})

router.post('/:providerId/:accountId/transactions', async (req, res) => {
  try {
    const { providerId, accountId } = req.params
    const body = ingestSchema.parse(req.body)
    
    const results: IngestResult[] = []
    
    for (const txn of body.transactions) {
      const dateISO = (txn.timestamp_posted || txn.timestamp_auth || new Date().toISOString()).slice(0, 10)
      const hashV1 = stableHashV1({
        providerId,
        accountId,
        dateISO,
        amountCents: Math.round(txn.amount * 100),
        description: txn.description_raw,
        currency: txn.currency
      })

      // Try to find existing transaction first (using individual fields)
      let raw = await prisma.rawTransaction.findFirst({
        where: {
          OR: [
            {
              providerId,
              accountId,
              hashV1
            },
            txn.provider_tx_id ? {
              providerId,
              providerTxId: txn.provider_tx_id
            } : { id: 'never-matches' }
          ]
        }
      })

      if (!raw) {
        // Create new transaction
        raw = await prisma.rawTransaction.create({
          data: {
            providerId,
            accountId,
            hashV1,
            providerTxId: txn.provider_tx_id,
            timestampPosted: txn.timestamp_posted ? new Date(txn.timestamp_posted) : null,
            timestampAuth: txn.timestamp_auth ? new Date(txn.timestamp_auth) : null,
            amount: txn.amount,
            currency: txn.currency,
            descriptionRaw: txn.description_raw,
            counterpartyRaw: txn.counterparty_raw,
            balanceAfter: txn.balance_after,
            metaJson: txn.meta_json
          }
        })
      } else {
        // Update existing transaction if needed
        raw = await prisma.rawTransaction.update({
          where: { id: raw.id },
          data: {
            // Update timestamp if we get a more recent version
            timestampPosted: txn.timestamp_posted ? new Date(txn.timestamp_posted) : undefined,
            timestampAuth: txn.timestamp_auth ? new Date(txn.timestamp_auth) : undefined,
            balanceAfter: txn.balance_after
          }
        })
      }

      // Normalize to canonical
      const canonical = await normalizeRaw(raw)

      // Link transfers
      await linkTransfers(canonical.accountId, canonical.postedAt)

      // Post to ledger
      await postToLedger(canonical.id)

      // Classify transaction
      await classifyTransaction(canonical.id)

      results.push({
        rawId: raw.id,
        canonicalId: canonical.id
      })
    }

    logger.info(`Ingested ${results.length} transactions successfully`)

    res.json({
      ok: true,
      count: results.length,
      results
    })

  } catch (error) {
    logger.error('Ingestion error:', error)
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router