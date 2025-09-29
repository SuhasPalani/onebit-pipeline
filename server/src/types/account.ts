export interface AccountBalance {
  accountId: string
  currentBalance: number
  availableBalance?: number
  currency: string
  asOfDate: Date
}

export interface AccountSummary {
  id: string
  displayName: string
  accountType: string
  balance: AccountBalance
  transactionCount: number
  lastSyncAt?: Date
}