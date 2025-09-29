import { Request, Response, NextFunction } from 'express'

// Simple API key authentication for demo
// In production, use proper JWT or OAuth
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key']
  
  // For demo purposes, accept any API key
  // In production, validate against database/JWT
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' })
  }

  // Add user context to request
  ;(req as any).user = { id: 'user-123', apiKey }
  next()
}