import Redis from 'ioredis'
import { logger } from '../lib/logger'

export interface RedisConfig {
  url: string
  maxRetriesPerRequest: number
  enableReadyCheck: boolean
  lazyConnect: boolean
}

export const redisConfig: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://:redis_password@localhost:6379',
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
}

// Main Redis client for general caching
export const redis = new Redis(redisConfig.url, {
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
  enableReadyCheck: redisConfig.enableReadyCheck,
  lazyConnect: redisConfig.lazyConnect,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  }
})

redis.on('connect', () => {
  logger.info('Redis connected successfully')
})

redis.on('error', (error) => {
  logger.error('Redis connection error:', error)
})

redis.on('ready', () => {
  logger.info('Redis is ready to accept commands')
})

// Separate Redis client for Bull queues (recommended practice)
export const redisQueue = new Redis(redisConfig.url, {
  maxRetriesPerRequest: null, // Bull requires this to be null
  enableReadyCheck: false, // Disable ready check here for Bull compatibility
  lazyConnect: false // Set lazyConnect to false to ensure Bull uses the client immediately
})

// Cache helper functions
export class CacheService {
  private defaultTTL = 3600 // 1 hour in seconds
  private redisClient: Redis

  constructor(redisClient: Redis) {
    this.redisClient = redisClient
  }

  // Expose the Redis client for advanced operations
  getClient(): Redis {
    return this.redisClient
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.redisClient.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(key)
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern)
      if (keys.length > 0) {
        await this.redisClient.del(...keys)
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error)
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.redisClient.incr(key)
      if (ttl && value === 1) {
        await this.redisClient.expire(key, ttl)
      }
      return value
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error)
      return 0
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redisClient.exists(key)
      return result === 1
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  }
}

export const cache = new CacheService(redis)

// Graceful shutdown
export async function closeRedis() {
  try {
    await redis.quit()
    await redisQueue.quit()
    logger.info('Redis connections closed')
  } catch (error) {
    logger.error('Error closing Redis connections:', error)
  }
}