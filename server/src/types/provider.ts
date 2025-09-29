export interface Provider {
  id: string
  name: string
  type: 'aggregator' | 'direct'
  status: string
  createdAt: Date
}

export interface ProviderStats {
  id: string
  name: string
  accountCount: number
  transactionCount: number
  lastSyncAt?: Date
  errorRate: number
  isHealthy: boolean
}

export interface ProviderCredentials {
  clientId?: string
  clientSecret?: string
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  environment?: 'sandbox' | 'development' | 'production'
}

export interface ProviderLimits {
  requestsPerMinute: number
  requestsPerDay: number
  concurrentRequests: number
  maxAccountsPerUser: number
  maxTransactionsPerRequest: number
}

export interface ProviderCapabilities {
  supportsRealTime: boolean
  supportsWebhooks: boolean
  supportsPendingTransactions: boolean
  supportsBalances: boolean
  supportsIdentity: boolean
  maxHistoryDays: number
  supportedAccountTypes: string[]
  supportedCountries: string[]
}

export interface ProviderConfiguration {
  provider: Provider
  credentials: ProviderCredentials
  limits: ProviderLimits
  capabilities: ProviderCapabilities
  webhookUrl?: string
  isEnabled: boolean
}
