import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  })

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message

  res.status(err.status || 500).json({
    ok: false,
    error: message
  })
}