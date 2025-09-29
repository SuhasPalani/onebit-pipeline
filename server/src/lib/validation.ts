import { z } from 'zod'

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format')
export const currencySchema = z.string().length(3, 'Currency must be 3 characters')
export const amountSchema = z.number().finite('Amount must be a valid number')
export const dateSchema = z.string().datetime('Invalid datetime format')

// Transaction validation schemas
export const rawTransactionSchema = z.object({
  provider_tx_id: z.string().optional(),
  timestamp_posted: dateSchema.optional(),
  timestamp_auth: dateSchema.optional(),
  amount: amountSchema,
  currency: currencySchema.default('USD'),
  description_raw: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  counterparty_raw: z.string().max(200, 'Counterparty name too long').optional(),
  balance_after: amountSchema.optional(),
  meta_json: z.record(z.any()).default({})
})

export const ingestRequestSchema = z.object({
  transactions: z.array(rawTransactionSchema).min(1, 'At least one transaction required').max(1000, 'Too many transactions in batch')
})

// Account validation schemas
export const accountSchema = z.object({
  user_id: uuidSchema,
  provider_id: uuidSchema,
  institution_id: z.string().min(1, 'Institution ID required').max(100),
  account_type: z.enum(['bank_checking', 'bank_savings', 'credit_card', 'loan', 'investment']),
  currency: currencySchema.default('USD'),
  mask: z.string().max(20).optional(),
  display_name: z.string().max(100).optional()
})

// Classification validation schemas
export const classificationUpdateSchema = z.object({
  category_id: uuidSchema.optional(),
  confidence: z.number().min(0).max(1),
  locked_by_user: z.boolean().default(false),
  explanations: z.record(z.any()).default({})
})

// Query parameter schemas
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

export const transactionQuerySchema = z.object({
  account_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  min_amount: amountSchema.optional(),
  max_amount: amountSchema.optional(),
  category_id: uuidSchema.optional(),
  include_transfers: z.coerce.boolean().default(true)
}).merge(paginationSchema)

// Helper function to validate and parse request body
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`)
    }
    throw error
  }
}