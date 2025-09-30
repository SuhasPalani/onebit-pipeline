import { Job } from 'bull'
import {
  classificationQueue,
  transferDetectionQueue,
  reconciliationQueue,
  ingestionQueue
} from '../config/queue'
import { classifyTransaction } from '../services/classify'
import { linkTransfers } from '../services/transferDetect'
import { reconcileAccount } from '../services/reconcile'
import { normalizeRaw } from '../services/normalize'
import { postToLedger } from '../services/ledger'
import { runClassificationJob, runBatchClassificationJob } from '../jobs/classification'
import { runTransferDetectionJob } from '../jobs/transferDetection'
import { nightlyReconcileJob } from '../jobs/nightlyReconcile'
import { prisma } from '../lib/db'
import { stableHashV1 } from '../lib/hash'
import { logger } from '../lib/logger'

// Classification Worker
classificationQueue.process('classify-transaction', async (job: Job) => {
  const { txnId } = job.data
  logger.info(`Processing classification for transaction ${txnId}`)
  
  await classifyTransaction(txnId)
  
  return { txnId, status: 'classified' }
})

classificationQueue.process('classification-sweep', async (job: Job) => {
  logger.info('Running classification sweep')
  return await runBatchClassificationJob(100)
})

// Transfer Detection Worker
transferDetectionQueue.process('detect-transfers', async (job: Job) => {
  const { accountId, date } = job.data
  logger.info(`Detecting transfers for account ${accountId} around ${date}`)
  
  const linksCreated = await linkTransfers(accountId, new Date(date))
  
  return { accountId, date, linksCreated }
})

transferDetectionQueue.process('periodic-transfer-detection', async (job: Job) => {
  logger.info('Running periodic transfer detection')
  return await runTransferDetectionJob()
})

// Reconciliation Worker
reconciliationQueue.process('reconcile-account', async (job: Job) => {
  const { accountId, asOfDate } = job.data
  logger.info(`Reconciling account ${accountId}`)
  
  const date = asOfDate ? new Date(asOfDate) : new Date()
  const result = await reconcileAccount(accountId, date)
  
  return { accountId, result }
})

reconciliationQueue.process('nightly-reconciliation', async (job: Job) => {
  logger.info('Running nightly reconciliation')
  return await nightlyReconcileJob()
})

// Ingestion Worker (for async batch processing)
ingestionQueue.process('ingest-batch', async (job: Job) => {
  const { providerId, accountId, transactions } = job.data
  logger.info(`Processing ingestion batch: ${transactions.length} transactions`)
  
  const results = []
  
  for (const txn of transactions) {
    try {
      const dateISO = (txn.timestamp_posted || txn.timestamp_auth || new Date().toISOString()).slice(0, 10)
      const hashV1 = stableHashV1({
        providerId,
        accountId,
        dateISO,
        amountCents: Math.round(txn.amount * 100),
        description: txn.description_raw,
        currency: txn.currency || 'USD'
      })

      let raw = await prisma.rawTransaction.findFirst({
        where: {
          OR: [
            { providerId, accountId, hashV1 },
            txn.provider_tx_id ? { providerId, providerTxId: txn.provider_tx_id } : { id: 'never' }
          ]
        }
      })

      if (!raw) {
        raw = await prisma.rawTransaction.create({
          data: {
            providerId,
            accountId,
            hashV1,
            providerTxId: txn.provider_tx_id,
            timestampPosted: txn.timestamp_posted ? new Date(txn.timestamp_posted) : null,
            timestampAuth: txn.timestamp_auth ? new Date(txn.timestamp_auth) : null,
            amount: txn.amount,
            currency: txn.currency || 'USD',
            descriptionRaw: txn.description_raw,
            counterpartyRaw: txn.counterparty_raw,
            balanceAfter: txn.balance_after,
            metaJson: txn.meta_json || {}
          }
        })
      }

      const canonical = await normalizeRaw(raw)
      await linkTransfers(canonical.accountId, canonical.postedAt)
      await postToLedger(canonical.id)
      await classifyTransaction(canonical.id)

      results.push({ rawId: raw.id, canonicalId: canonical.id })
    } catch (error) {
      logger.error('Error processing transaction in batch:', error)
      results.push({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }
  
  return { 
    providerId, 
    accountId, 
    processed: transactions.length,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length
  }
})

export function startWorkers() {
  logger.info('Queue workers initialized and listening for jobs')
  
  // Log worker status periodically
  setInterval(async () => {
    const [classActive, transferActive, reconActive, ingestActive] = await Promise.all([
      classificationQueue.getActiveCount(),
      transferDetectionQueue.getActiveCount(),
      reconciliationQueue.getActiveCount(),
      ingestionQueue.getActiveCount()
    ])
    
    logger.debug('Active jobs:', {
      classification: classActive,
      transfers: transferActive,
      reconciliation: reconActive,
      ingestion: ingestActive
    })
  }, 60000) // Every minute
}