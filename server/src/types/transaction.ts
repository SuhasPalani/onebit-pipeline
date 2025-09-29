export interface TransactionSummary {
  id: string
  accountId: string
  amount: number
  description: string
  date: Date
  isTransfer: boolean
  category?: string
}

export interface TransferPair {
  outTransaction: TransactionSummary
  inTransaction: TransactionSummary
  confidence: number
  detectionMethod: string
}