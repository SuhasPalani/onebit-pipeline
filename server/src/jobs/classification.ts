import { prisma } from '../lib/db'
import { classifyTransaction } from '../services/classify'
import { logger } from '../lib/logger'

export async function runClassificationJob() {
  logger.info('Starting classification job')

  try {
    // Find unclassified transactions or low-confidence classifications
    const unclassifiedTransactions = await prisma.canonicalTransaction.findMany({
      where: {
        OR: [
          { classification: null },
          {
            classification: {
              confidence: { lt: 0.6 },
              lockedByUser: false
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // Process in batches
    })

    let classified = 0
    let errors = 0

    for (const txn of unclassifiedTransactions) {
      try {
        await classifyTransaction(txn.id)
        classified++
      } catch (error) {
        logger.error(`Failed to classify transaction ${txn.id}:`, error)
        errors++
      }
    }

    logger.info(`Classification job completed. Classified ${classified} transactions, ${errors} errors`)
    
    return {
      transactionsProcessed: unclassifiedTransactions.length,
      classified,
      errors
    }
  } catch (error) {
    logger.error('Classification job failed:', error)
    throw error
  }
}

// Batch classification for performance
export async function runBatchClassificationJob(batchSize = 100) {
  logger.info(`Starting batch classification job with batch size ${batchSize}`)

  try {
    let offset = 0
    let totalProcessed = 0
    let totalClassified = 0

    while (true) {
      const batch = await prisma.canonicalTransaction.findMany({
        where: {
          OR: [
            { classification: null },
            {
              classification: {
                confidence: { lt: 0.6 },
                lockedByUser: false
              }
            }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: batchSize,
        skip: offset
      })

      if (batch.length === 0) break

      // Process batch in parallel with concurrency limit
      const classificationPromises = batch.map((txn: typeof batch[number]) => 
        classifyTransaction(txn.id).then(() => 1).catch(err => {
          logger.error(`Classification failed for ${txn.id}:`, err)
          return 0
        })
      )

      const results = await Promise.all(classificationPromises)
      const batchClassified = results.reduce((sum, result) => sum + result, 0)

      totalProcessed += batch.length
      totalClassified += batchClassified
      offset += batchSize

      logger.info(`Processed batch: ${batch.length} transactions, ${batchClassified} classified`)

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info(`Batch classification job completed. Processed ${totalProcessed} transactions, classified ${totalClassified}`)
    
    return {
      totalProcessed,
      totalClassified,
      batchSize
    }
  } catch (error) {
    logger.error('Batch classification job failed:', error)
    throw error
  }
}