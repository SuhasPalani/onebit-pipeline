import rateLimit from 'express-rate-limit'

export const ingestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs for ingestion
  message: 'Too many ingestion requests, please try again later'
})

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests, please try again later'
})