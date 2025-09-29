export interface NormalizedMerchant {
  name: string
  counterparty: string | null
}

const merchantMap: Record<string, string> = {
  'SQ *': 'Square',
  'AMZN MKTP': 'Amazon',
  'PAYPAL *': 'PayPal',
  'UBER *': 'Uber',
  'STARBUCKS': 'Starbucks'
}

export function normalizeMerchant(description: string): NormalizedMerchant {
  const cleaned = description.trim().toUpperCase()
  
  for (const [pattern, normalized] of Object.entries(merchantMap)) {
    if (cleaned.includes(pattern.toUpperCase())) {
      return {
        name: normalized,
        counterparty: normalized
      }
    }
  }
  
  // Extract merchant from common patterns
  const patterns = [
    /^(.+?)\s+\d{2}\/\d{2}/, // "MERCHANT 12/31"
    /^(.+?)\s*#\d+/, // "MERCHANT #123"
    /^(.+?)\s+[\d.]+$/, // "MERCHANT 123.45"
  ]
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) {
      return {
        name: match[1].trim(),
        counterparty: match[1].trim()
      }
    }
  }
  
  return {
    name: cleaned,
    counterparty: null
  }
}
