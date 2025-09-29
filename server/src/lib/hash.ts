import crypto from 'crypto'

export interface HashInput {
  providerId: string
  accountId: string
  dateISO: string
  amountCents: number
  description: string
  currency: string
}

export function stableHashV1(input: HashInput): string {
  const base = `${input.providerId}|${input.accountId}|${input.dateISO}|${input.amountCents}|${scrub(input.description)}|${input.currency}`
  return crypto.createHash('sha256').update(base).digest('hex')
}

export function scrub(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase()
}
