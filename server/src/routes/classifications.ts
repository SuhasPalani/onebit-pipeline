import { Router } from 'express'
import { prisma } from '../lib/db'
import { classifyTransaction } from '../services/classify'
import { uuidSchema, classificationUpdateSchema, paginationSchema } from '../lib/validation'
import { logger } from '../lib/logger'

const router = Router()

// Get classification for specific transaction
router.get('/transaction/:transactionId', async (req, res) => {
  try {
    const transactionId = uuidSchema.parse(req.params.transactionId)

    const classification = await prisma.classification.findUnique({
      where: { txnId: transactionId },
      include: {
        category: true,
        transaction: {
          select: {
            descriptionNorm: true,
            amount: true,
            postedAt: true
          }
        }
      }
    })

    if (!classification) {
      return res.status(404).json({ error: 'Classification not found' })
    }

    res.json(classification)
  } catch (error) {
    logger.error('Error fetching classification:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Update classification for transaction
router.put('/transaction/:transactionId', async (req, res) => {
  try {
    const transactionId = uuidSchema.parse(req.params.transactionId)
    const updateData = classificationUpdateSchema.parse(req.body)

    const classification = await prisma.classification.upsert({
      where: { txnId: transactionId },
      create: {
        txnId: transactionId,
        categoryId: updateData.category_id,
        confidence: updateData.confidence,
        lockedByUser: updateData.locked_by_user,
        explanations: updateData.explanations,
        modelVersion: 'manual'
      },
      update: {
        categoryId: updateData.category_id,
        confidence: updateData.confidence,
        lockedByUser: updateData.locked_by_user,
        explanations: updateData.explanations,
        updatedAt: new Date()
      },
      include: {
        category: true
      }
    })

    res.json({
      ok: true,
      classification
    })
  } catch (error) {
    logger.error('Error updating classification:', error)
    res.status(500).json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Get unclassified transactions (low confidence)
router.get('/unclassified', async (req, res) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query)
    const confidenceThreshold = parseFloat(req.query.threshold as string || '0.6')

    const unclassified = await prisma.classification.findMany({
      where: {
        confidence: { lt: confidenceThreshold },
        lockedByUser: false
      },
      include: {
        transaction: {
          include: {
            account: {
              select: {
                displayName: true,
                accountType: true
              }
            }
          }
        },
        category: true
      },
      orderBy: { confidence: 'asc' },
      take: limit,
      skip: offset
    })

    res.json(unclassified)
  } catch (error) {
    logger.error('Error fetching unclassified transactions:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Trigger auto-classification for transaction
router.post('/transaction/:transactionId/auto-classify', async (req, res) => {
  try {
    const transactionId = uuidSchema.parse(req.params.transactionId)

    await classifyTransaction(transactionId)

    const classification = await prisma.classification.findUnique({
      where: { txnId: transactionId },
      include: { category: true }
    })

    res.json({
      ok: true,
      classification
    })
  } catch (error) {
    logger.error('Error auto-classifying transaction:', error)
    res.status(500).json({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            classifications: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    res.json(categories)
  } catch (error) {
    logger.error('Error fetching categories:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Create new category
router.post('/categories', async (req, res) => {
  try {
    const categoryData = {
      name: req.body.name,
      parentId: req.body.parent_id,
      isTransfer: req.body.is_transfer || false,
      isPayment: req.body.is_payment || false,
      isRefund: req.body.is_refund || false,
      gaapMap: req.body.gaap_map
    }

    const category = await prisma.category.create({
      data: categoryData
    })

    res.json(category)
  } catch (error) {
    logger.error('Error creating category:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
})

export default router