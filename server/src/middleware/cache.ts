import { Request, Response, NextFunction } from 'express'
import { cache } from '../config/redis'
import { logger } from '../lib/logger'

const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
}

// Generate cache key from request
function getCacheKey(req: Request): string {
  const base = req.originalUrl || req.url
  const userId = (req as any).user?.id || 'anonymous'
  return `cache:${userId}:${base}`
}

// Generic cache middleware
export function cacheMiddleware(ttl: number = CACHE_TTL.MEDIUM) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const key = getCacheKey(req)

    try {
      const cached = await cache.get(key)
      
      if (cached) {
        logger.debug(`Cache hit: ${key}`)
        return res.json(cached)
      }

      logger.debug(`Cache miss: ${key}`)

      // Override res.json to cache the response
      const originalJson = res.json.bind(res)
      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(key, data, ttl).catch(err => 
            logger.error('Cache set error:', err)
          )
        }
        return originalJson(data)
      }

      next()
    } catch (error) {
      logger.error('Cache middleware error:', error)
      next() // Fail open
    }
  }
}

// Specific cache middlewares
export const accountCacheMiddleware = cacheMiddleware(CACHE_TTL.MEDIUM)
export const transactionCacheMiddleware = cacheMiddleware(CACHE_TTL.SHORT)
export const categoryCacheMiddleware = cacheMiddleware(CACHE_TTL.LONG)

// Cache invalidation helpers
export async function invalidateAccountCache(accountId: string) {
  try {
    await cache.deletePattern(`cache:*:/api/accounts/${accountId}*`)
    await cache.deletePattern(`cache:*:/api/accounts*`)
    logger.debug(`Invalidated cache for account ${accountId}`)
  } catch (error) {
    logger.error('Error invalidating account cache:', error)
  }
}

export async function invalidateTransactionCache(accountId?: string) {
  try {
    if (accountId) {
      await cache.deletePattern(`cache:*:/api/transactions*account_id=${accountId}*`)
    } else {
      await cache.deletePattern(`cache:*:/api/transactions*`)
    }
    logger.debug('Invalidated transaction cache')
  } catch (error) {
    logger.error('Error invalidating transaction cache:', error)
  }
}

export async function invalidateCategoryCache() {
  try {
    await cache.deletePattern(`cache:*:/api/classifications/categories*`)
    logger.debug('Invalidated category cache')
  } catch (error) {
    logger.error('Error invalidating category cache:', error)
  }
}