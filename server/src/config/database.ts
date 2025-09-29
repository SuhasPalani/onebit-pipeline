import { PrismaClient } from '@prisma/client'

export interface DatabaseConfig {
  url: string
  maxConnections: number
  connectionTimeout: number
  logLevel: 'info' | 'query' | 'warn' | 'error'
}

export const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/onebit?schema=onebit',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
  logLevel: (process.env.DB_LOG_LEVEL as any) || 'error'
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [databaseConfig.logLevel],
    datasources: {
      db: {
        url: databaseConfig.url
      }
    }
  })
}
