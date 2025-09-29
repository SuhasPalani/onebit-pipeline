import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

interface ClassificationRule {
  pattern: RegExp
  categoryName: string
  confidence: number
}

const classificationRules: ClassificationRule[] = [
  { pattern: /starbucks|coffee|cafe/i, categoryName: 'Meals & Entertainment', confidence: 0.9 },
  { pattern: /uber|lyft|taxi/i, categoryName: 'Transportation', confidence: 0.85 },
  { pattern: /amazon|amzn mktp/i, categoryName: 'Shopping', confidence: 0.8 },
  { pattern: /paypal|venmo|zelle/i, categoryName: 'Transfer', confidence: 0.7 },
  { pattern: /fee|charge/i, categoryName: 'Bank Fees', confidence: 0.9 },
  { pattern: /interest/i, categoryName: 'Interest Income', confidence: 0.95 },
  { pattern: /payment.*thank/i, categoryName: 'Payment', confidence: 0.9 }
]

export async function classifyTransaction(txnId: string) {
  const transaction = await prisma.canonicalTransaction.findUnique({
    where: { id: txnId }
  })

  if (!transaction) return

  // Check if already classified and locked by user
  const existing = await prisma.classification.findUnique({
    where: { txnId }
  })

  if (existing?.lockedByUser) return

  let bestMatch: { categoryName: string; confidence: number; explanation: string } | null = null

  // Apply rules in order
  for (const rule of classificationRules) {
    if (rule.pattern.test(transaction.descriptionNorm)) {
      bestMatch = {
        categoryName: rule.categoryName,
        confidence: rule.confidence,
        explanation: `Matched pattern: ${rule.pattern.toString()}`
      }
      break
    }
  }

  if (!bestMatch) {
    // Default classification
    bestMatch = {
      categoryName: Number(transaction.amount) < 0 ? 'Uncategorized Expense' : 'Uncategorized Income',
      confidence: 0.1,
      explanation: 'No matching rules found'
    }
  }

  // Find or create category
  let category = await prisma.category.findFirst({
    where: { name: bestMatch.categoryName }
  })

  if (!category) {
    category = await prisma.category.create({
      data: { name: bestMatch.categoryName }
    })
  }

  // Upsert classification
  await prisma.classification.upsert({
    where: { txnId },
    create: {
      txnId,
      categoryId: category.id,
      confidence: bestMatch.confidence,
      modelVersion: '1.0',
      explanations: { rule: bestMatch.explanation }
    },
    update: {
      categoryId: category.id,
      confidence: bestMatch.confidence,
      explanations: { rule: bestMatch.explanation },
      updatedAt: new Date()
    }
  })

  logger.info(`Classified transaction ${txnId} as ${bestMatch.categoryName} (${bestMatch.confidence})`)
}
