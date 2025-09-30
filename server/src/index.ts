import app from './app'
import { logger } from './lib/logger'
import { prisma } from './lib/db'
import { redis, closeRedis } from './config/redis'
import { setupRecurringJobs, closeQueues } from './config/queue'
import { startWorkers } from './workers'

const PORT = process.env.PORT || 3001

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    logger.info('✓ Database connected successfully')

    // Test Redis connection
    await redis.ping()
    logger.info('✓ Redis connected successfully')

    // Setup recurring jobs
    await setupRecurringJobs()
    logger.info('✓ Recurring jobs scheduled')

    // Start queue workers
    startWorkers()
    logger.info('✓ Queue workers started')

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`✓ Server running on port ${PORT}`)
      logger.info(`  Health check: http://localhost:${PORT}/api/health`)
      logger.info(`  Environment: ${process.env.NODE_ENV}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)
  
  try {
    // Close queues first
    await closeQueues()
    logger.info('✓ Queues closed')

    // Close Redis connections
    await closeRedis()
    logger.info('✓ Redis closed')

    // Disconnect database
    await prisma.$disconnect()
    logger.info('✓ Database disconnected')

    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))