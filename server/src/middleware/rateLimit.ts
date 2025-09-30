import { Request, Response, NextFunction } from 'express'
import { cache } from '../config/redis'
import { logger } from '../lib/logger'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
  keyGenerator?: (req: Request) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export function createRedisRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `rate_limit:${keyGenerator(req)}`
    const windowSeconds = Math.ceil(windowMs / 1000)

    try {
      const current = await cache.increment(key, windowSeconds)

      // Set headers for rate limit info
      res.setHeader('X-RateLimit-Limit', maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString())
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString())

      if (current > maxRequests) {
        logger.warn(`Rate limit exceeded for ${keyGenerator(req)}`)
        return res.status(429).json({
          error: message,
          retryAfter: windowSeconds
        })
      }

      // Handle skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalJson = res.json.bind(res)
        res.json = function(body: any) {
          const shouldSkip = 
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400)
          
          if (shouldSkip) {
            cache.delete(key).catch(err => 
              logger.error('Error deleting rate limit key:', err)
            )
          }
          return originalJson(body)
        }
      }

      next()
    } catch (error) {
      logger.error('Rate limit middleware error:', error)
      // Fail open - allow request if Redis is down
      next()
    }
  }
}

// Predefined rate limiters
export const ingestRateLimit = createRedisRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50,
  message: 'Too many ingestion requests, please try again later',
  keyGenerator: (req) => `ingest:${req.ip}:${req.params.accountId || 'unknown'}`
})

export const generalRateLimit = createRedisRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
  message: 'Too many requests, please try again later'
})

export const authRateLimit = createRedisRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => `auth:${req.ip}:${req.body.email || 'unknown'}`
})

// Advanced: Sliding window rate limiter using Redis sorted sets
export async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000
  const redisKey = `sliding:${key}`
  const redisClient = cache.getClient() // Use the getter method

  try {
    // Add current request
    await redisClient.zadd(redisKey, now, `${now}`)
    
    // Remove old entries
    await redisClient.zremrangebyscore(redisKey, 0, windowStart)
    
    // Count requests in window
    const count = await redisClient.zcard(redisKey)
    
    // Set expiry
    await redisClient.expire(redisKey, windowSeconds)

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count)
    }
  } catch (error) {
    logger.error('Sliding window rate limit error:', error)
    return { allowed: true, remaining: limit }
  }
}