// server/src/types/plaid.ts
import type { Transaction, Location } from 'plaid';

// Re-export Plaid's built-in Transaction type
export type PlaidTransaction = Transaction;

// Extended account metadata to include Plaid tokens
export interface AccountMetadata {
  plaid_access_token?: string;
  plaid_item_id?: string;
  plaid_account_id?: string;
  last_sync_date?: string;
  sync_cursor?: string; // For incremental sync (future enhancement)
}

// Transformed transaction (your internal format)
export interface TransformedPlaidTransaction {
  provider_tx_id: string;
  timestamp_posted: string;
  timestamp_auth?: string;
  amount: number;
  currency: string;
  description_raw: string;
  counterparty_raw: string | null;
  meta_json: {
    category: string[] | null;
    pending: boolean;
    location: Location | null;
    payment_channel: string;
    plaid_transaction_type: string;
  };
}

// Plaid webhook payload types
export interface PlaidWebhook {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error: PlaidError | null;
  new_transactions?: number;
  removed_transactions?: string[];
}

export interface PlaidError {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message: string | null;
}

// Link token creation request
export interface LinkTokenRequest {
  user_id: string;
}

// Link token exchange request
export interface ExchangeTokenRequest {
  public_token: string;
  account_id: string;
}

// Sync request
export interface SyncRequest {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}