import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

export async function dedupePending(canonical: any) {
  // Find potential pending transactions that match this posted transaction
  const pending = await prisma.canonicalTransaction.findMany({
    where: {
      accountId: canonical.accountId,
      status: 'pending',
      amount: canonical.amount,
      postedAt: {
        gte: new Date(canonical.postedAt.getTime() - 3 * 24 * 60 * 60 * 1000),
        lte: new Date(canonical.postedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      }
    }
  })

  for (const pendingTxn of pending) {
    // Check string similarity between descriptions
    const similarity = stringSimilarity(
      canonical.descriptionNorm.toLowerCase(),
      pendingTxn.descriptionNorm.toLowerCase()
    )

    if (similarity > 0.8) {
      // Merge the pending into the posted transaction
      await prisma.canonicalTransaction.update({
        where: { id: canonical.id },
        data: {
          rawIds: {
            push: [...pendingTxn.rawIds]
          }
        }
      })

      // Delete the pending transaction
      await prisma.canonicalTransaction.delete({
        where: { id: pendingTxn.id }
      })

      logger.info(`Merged pending transaction ${pendingTxn.id} into ${canonical.id}`)
    }
  }
}

function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  return (longer.length - editDistance(longer, shorter)) / longer.length
}

function editDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}
