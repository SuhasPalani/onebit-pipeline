import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import routes from './routes'
import { logger } from './lib/logger'
import { generalRateLimit } from './middleware/rateLimit'

const app = express()

// Security middleware
// Security middleware with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline scripts
        "https://cdn.plaid.com"  // Allow Plaid CDN
      ],
      connectSrc: [
        "'self'",
        "https://cdn.plaid.com",
        "https://production.plaid.com",
        "https://development.plaid.com",
        "https://sandbox.plaid.com"
      ],
      frameSrc: [
        "https://cdn.plaid.com"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}))
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3001'  // Add this line - allow your own server
  ],
  credentials: true
}))
// Rate limiting (Redis-based)
app.use('/api', generalRateLimit)

// Body parsing
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}))

// Serve static files BEFORE routes
app.use(express.static('public'))

// Routes
app.use('/api', routes)

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err)
  res.status(err.status || 500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  })
})

// 404 handler (MUST BE LAST)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

export default app