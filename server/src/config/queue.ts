import Queue from 'bull'
import { redisQueue } from './redis'
import { logger } from '../lib/logger'

// Queue options
const defaultQueueOptions = {
  createClient: (type: string) => {
    switch (type) {
      case 'client':
      case 'subscriber':
      case 'bclient':
        // Return the appropriate Redis client (without conflicting options)
        return redisQueue.duplicate() // No need for maxRetriesPerRequest or enableReadyCheck
      default:
        return redisQueue.duplicate()
    }
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200,     // Keep last 200 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
}

// Classification Queue
export const classificationQueue = new Queue('classification', defaultQueueOptions)

classificationQueue.on('completed', (job, result) => {
  logger.info(`Classification job ${job.id} completed:`, result)
})

classificationQueue.on('failed', (job, err) => {
  logger.error(`Classification job ${job?.id} failed:`, err)
})

// Transfer Detection Queue
export const transferDetectionQueue = new Queue('transfer-detection', defaultQueueOptions)

transferDetectionQueue.on('completed', (job, result) => {
  logger.info(`Transfer detection job ${job.id} completed:`, result)
})

transferDetectionQueue.on('failed', (job, err) => {
  logger.error(`Transfer detection job ${job?.id} failed:`, err)
})

// Reconciliation Queue
export const reconciliationQueue = new Queue('reconciliation', defaultQueueOptions)

reconciliationQueue.on('completed', (job, result) => {
  logger.info(`Reconciliation job ${job.id} completed:`, result)
})

reconciliationQueue.on('failed', (job, err) => {
  logger.error(`Reconciliation job ${job?.id} failed:`, err)
})

// Ingestion Queue (for async processing of large batches)
export const ingestionQueue = new Queue('ingestion', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5 // More retries for critical ingestion
  }
})

ingestionQueue.on('completed', (job, result) => {
  logger.info(`Ingestion job ${job.id} completed:`, result)
})

ingestionQueue.on('failed', (job, err) => {
  logger.error(`Ingestion job ${job?.id} failed:`, err)
})

// Queue Helper Functions
export async function addClassificationJob(txnId: string, priority: number = 0) {
  return classificationQueue.add(
    'classify-transaction',
    { txnId },
    { priority }
  )
}

export async function addTransferDetectionJob(accountId: string, date: Date) {
  return transferDetectionQueue.add(
    'detect-transfers',
    { accountId, date: date.toISOString() },
    { delay: 5000 } // Wait 5 seconds to batch transactions
  )
}

export async function addReconciliationJob(accountId: string, asOfDate?: Date) {
  return reconciliationQueue.add(
    'reconcile-account',
    { accountId, asOfDate: asOfDate?.toISOString() }
  )
}

export async function addIngestionJob(
  providerId: string,
  accountId: string,
  transactions: any[]
) {
  return ingestionQueue.add(
    'ingest-batch',
    { providerId, accountId, transactions },
    { priority: 1 }
  )
}

// Schedule recurring jobs
export async function setupRecurringJobs() {
  // Nightly reconciliation at 2 AM
  await reconciliationQueue.add(
    'nightly-reconciliation',
    {},
    {
      repeat: {
        cron: '0 2 * * *' // 2 AM every day
      }
    }
  )

  // Transfer detection every 15 minutes
  await transferDetectionQueue.add(
    'periodic-transfer-detection',
    {},
    {
      repeat: {
        cron: '*/15 * * * *' // Every 15 minutes
      }
    }
  )

  // Classification sweep every hour
  await classificationQueue.add(
    'classification-sweep',
    {},
    {
      repeat: {
        cron: '0 * * * *' // Every hour
      }
    }
  )

  logger.info('Recurring jobs scheduled successfully')
}

// Graceful shutdown
export async function closeQueues() {
  try {
    await Promise.all([
      classificationQueue.close(),
      transferDetectionQueue.close(),
      reconciliationQueue.close(),
      ingestionQueue.close()
    ])
    logger.info('All queues closed')
  } catch (error) {
    logger.error('Error closing queues:', error)
  }
}