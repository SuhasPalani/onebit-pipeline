export interface RawTransactionInput {
  provider_tx_id?: string
  timestamp_posted?: string
  timestamp_auth?: string
  amount: number
  currency?: string
  description_raw: string
  counterparty_raw?: string
  balance_after?: number
  meta_json?: any
}

export interface IngestRequest {
  transactions: RawTransactionInput[]
}

export interface IngestResult {
  rawId: string
  canonicalId: string
}