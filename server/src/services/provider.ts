import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

export interface ProviderConfig {
  id: string
  name: string
  type: 'aggregator' | 'direct'
  baseUrl?: string
  credentials?: {
    clientId?: string
    clientSecret?: string
    apiKey?: string
  }
  rateLimit?: {
    requestsPerMinute: number
    burstSize: number
  }
  features?: {
    supportsWebhooks: boolean
    supportsRealTime: boolean
    supportsPending: boolean
    maxHistoryDays: number
  }
}

export class ProviderService {
  async getProvider(providerId: string) {
    return prisma.provider.findUnique({
      where: { id: providerId }
    })
  }

  async createProvider(data: {
    name: string
    type: 'aggregator' | 'direct'
    status?: string
  }) {
    return prisma.provider.create({
      data: {
        name: data.name,
        type: data.type,
        status: data.status || 'active'
      }
    })
  }

  async updateProviderStatus(providerId: string, status: string) {
    return prisma.provider.update({
      where: { id: providerId },
      data: { status }
    })
  }

  async getProviderHealth(providerId: string) {
    const provider = await this.getProvider(providerId)
    if (!provider) throw new Error('Provider not found')

    // Get recent ingestion stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const stats = await prisma.rawTransaction.aggregate({
      where: {
        providerId,
        ingestedAt: { gte: last24Hours }
      },
      _count: { id: true },
      _min: { ingestedAt: true },
      _max: { ingestedAt: true }
    })

    // Get error rate (could be from failed ingestion attempts)
    const accounts = await prisma.account.count({
      where: { providerId }
    })

    return {
      providerId,
      providerName: provider.name,
      status: provider.status,
      accountCount: accounts,
      transactionsLast24h: stats._count.id,
      lastIngestionAt: stats._max.ingestedAt,
      isHealthy: provider.status === 'active' && stats._count.id > 0
    }
  }

  async listProviders() {
    return prisma.provider.findMany({
      include: {
        _count: {
          select: {
            accounts: true,
            rawTransactions: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
  }
}