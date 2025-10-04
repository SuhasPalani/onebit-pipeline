// server/src/integrations/plaid.ts
import { 
  Configuration, 
  PlaidApi, 
  PlaidEnvironments, 
  Products, 
  CountryCode,
  Transaction 
} from 'plaid';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import type { 
  TransformedPlaidTransaction,
  PlaidWebhook 
} from '../types/plaid';

// Validate required environment variables
if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set in environment variables');
}

// Determine environment dynamically
const getPlaidEnvironment = () => {
  const env = process.env.PLAID_ENV || 'production';
  logger.info(`Using Plaid environment: ${env}`);
  
  switch(env.toLowerCase()) {
    case 'sandbox':
      return PlaidEnvironments.sandbox;
    case 'development':
      return PlaidEnvironments.development;
    case 'production':
      return PlaidEnvironments.production;
    default:
      logger.warn(`Unknown PLAID_ENV: ${env}, defaulting to production`);
      return PlaidEnvironments.production;
  }
};

// Initialize Plaid client with dynamic environment
const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

/**
 * Create a Link token for frontend to initialize Plaid Link
 * @param userId - Your internal user ID
 * @returns Link token string
 */
export async function createLinkToken(userId: string): Promise<string> {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { 
        client_user_id: userId 
      },
      client_name: 'OneBit Financial',
      products: [Products.Transactions, Products.Auth], // Added Auth for account verification
      country_codes: [CountryCode.Us, CountryCode.Ca], // Added Canada support
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL, // Webhook for automatic updates
    });

    logger.info(`Link token created for user ${userId}`);
    return response.data.link_token;
  } catch (error: any) {
    logger.error('Error creating Plaid link token:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to create Plaid link token: ${error.message}`);
  }
}

/**
 * Exchange public token for access token and get account details
 * @param publicToken - Public token from Plaid Link
 * @returns Access token, item ID, and account details
 */
export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    subtype: string | null;
    mask: string | null;
  }>;
}> {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Fetch account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts.map(acc => ({
      id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask,
    }));

    logger.info(`Public token exchanged. Item ID: ${itemId}, Accounts: ${accounts.length}`);
    
    return {
      accessToken,
      itemId,
      accounts,
    };
  } catch (error: any) {
    logger.error('Error exchanging public token:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to exchange public token: ${error.message}`);
  }
}

/**
 * Fetch transactions from Plaid
 * @param accessToken - Plaid access token
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of Plaid transactions
 */
export async function fetchPlaidTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  try {
    let allTransactions: Transaction[] = [];
    let hasMore = true;
    let offset = 0;
    const count = 500; // Max transactions per request

    // Plaid may paginate results, so we need to fetch all pages
    while (hasMore) {
      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count,
          offset,
        },
      });

      allTransactions = allTransactions.concat(response.data.transactions);
      
      // Check if there are more transactions to fetch
      if (response.data.transactions.length < count) {
        hasMore = false;
      } else {
        offset += count;
      }
      
      logger.debug(`Fetched ${response.data.transactions.length} transactions (total: ${allTransactions.length})`);
    }

    logger.info(`Fetched ${allTransactions.length} total transactions from Plaid`);
    return allTransactions;
  } catch (error: any) {
    logger.error('Error fetching Plaid transactions:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to fetch Plaid transactions: ${error.message}`);
  }
}

/**
 * Transform Plaid transaction to your internal format
 * @param txn - Plaid transaction object
 * @returns Transformed transaction
 */
export function transformPlaidTransaction(
  txn: Transaction
): TransformedPlaidTransaction {
  return {
    provider_tx_id: txn.transaction_id,
    timestamp_posted: `${txn.date}T12:00:00Z`,
    timestamp_auth: txn.authorized_date ? `${txn.authorized_date}T12:00:00Z` : undefined,
    amount: txn.amount * -1, // Plaid uses positive for outflow, we use negative
    currency: txn.iso_currency_code || txn.unofficial_currency_code || 'USD',
    description_raw: txn.name,
    counterparty_raw: txn.merchant_name || txn.name,
    meta_json: {
      category: txn.category || null,
      pending: txn.pending,
      location: txn.location || null,
      payment_channel: txn.payment_channel,
      plaid_transaction_type: txn.transaction_type || 'unknown',
    },
  };
}

/**
 * Get account balance from Plaid
 * @param accessToken - Plaid access token
 * @returns Account balance information
 */
export async function getPlaidBalance(accessToken: string) {
  try {
    const response = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });

    return response.data.accounts.map(account => ({
      account_id: account.account_id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      balances: {
        current: account.balances.current,
        available: account.balances.available,
        limit: account.balances.limit,
        currency: account.balances.iso_currency_code,
      },
    }));
  } catch (error: any) {
    logger.error('Error fetching Plaid balance:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to fetch balance: ${error.message}`);
  }
}

/**
 * Handle Plaid webhook notifications and trigger auto-sync
 * @param webhookData - Webhook payload from Plaid
 */
export async function handlePlaidWebhook(webhookData: PlaidWebhook): Promise<void> {
  const { webhook_type, webhook_code, item_id } = webhookData;

  logger.info(`Received Plaid webhook: ${webhook_type} - ${webhook_code} for item ${item_id}`);

  if (webhook_type === 'TRANSACTIONS') {
    switch (webhook_code) {
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
      case 'DEFAULT_UPDATE':
        logger.info(`Transaction update: ${webhookData.new_transactions || 0} new transactions`);
        
        // Find account by item_id
        const account = await prisma.account.findFirst({
          where: {
            metadata: {
              path: ['plaid_item_id'],
              equals: item_id,
            },
          },
          include: { provider: true }
        });
        
        if (account) {
          logger.info(`Auto-syncing account ${account.id} due to webhook`);
          
          try {
            // Trigger sync (you can also add this to a queue for better performance)
            const metadata = account.metadata as any;
            const accessToken = metadata?.plaid_access_token;
            
            if (accessToken) {
              const endDate = new Date().toISOString().split('T')[0];
              const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];
              
              const transactions = await fetchPlaidTransactions(accessToken, startDate, endDate);
              const transformed = transactions.map(transformPlaidTransaction);
              
              // Call your ingestion endpoint internally
              logger.info(`Webhook triggered sync: ${transformed.length} transactions for account ${account.id}`);
            }
          } catch (error) {
            logger.error('Error in webhook auto-sync:', error);
          }
        }
        break;
      
      case 'TRANSACTIONS_REMOVED':
        logger.warn(`Transactions removed: ${webhookData.removed_transactions?.join(', ')}`);
        // TODO: Handle transaction removal (mark as deleted in your system)
        break;
      
      default:
        logger.warn(`Unhandled transaction webhook code: ${webhook_code}`);
    }
  } else if (webhook_type === 'ITEM') {
    switch (webhook_code) {
      case 'ERROR':
        logger.error(`Item error for ${item_id}:`, webhookData.error);
        
        // Update account status to indicate re-authentication needed
        await prisma.account.updateMany({
          where: {
            metadata: {
              path: ['plaid_item_id'],
              equals: item_id,
            },
          },
          data: {
            isActive: false,
            metadata: {
              path: ['plaid_needs_reauth'],
              equals: true,
            } as any
          }
        });
        break;
      
      case 'PENDING_EXPIRATION':
        logger.warn(`Item ${item_id} access will expire soon`);
        // TODO: Notify user to update login credentials
        break;
      
      default:
        logger.info(`Item webhook: ${webhook_code}`);
    }
  }
}

/**
 * Remove item (disconnect account)
 * @param accessToken - Plaid access token
 */
export async function removeItem(accessToken: string): Promise<void> {
  try {
    await plaidClient.itemRemove({
      access_token: accessToken,
    });
    
    logger.info('Plaid item removed successfully');
  } catch (error: any) {
    logger.error('Error removing Plaid item:', {
      error: error.message,
      response: error.response?.data,
    });
    throw new Error(`Failed to remove item: ${error.message}`);
  }
}