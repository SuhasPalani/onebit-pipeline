import { Router } from 'express';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import {
  createLinkToken,
  exchangePublicToken,
  fetchPlaidTransactions,
  transformPlaidTransaction,
  getPlaidBalance,
  handlePlaidWebhook,
  removeItem,
} from '../integrations/plaid';
import type { 
  AccountMetadata, 
  LinkTokenRequest, 
  ExchangeTokenRequest,
  SyncRequest 
} from '../types/plaid';

const router = Router();

/**
 * POST /api/plaid/link/token
 * Create a link token for Plaid Link initialization
 */
router.post('/link/token', async (req, res) => {
  try {
    const { user_id } = req.body as LinkTokenRequest;
    
    if (!user_id) {
      return res.status(400).json({ 
        error: 'user_id is required',
        details: 'Provide user_id in request body'
      });
    }

    const linkToken = await createLinkToken(user_id);
    
    res.json({ 
      link_token: linkToken,
      expiration: '4 hours'
    });
  } catch (error) {
    logger.error('Error in /link/token:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/plaid/link/exchange
 * Exchange public token for access token and link account
 */
router.post('/link/exchange', async (req, res) => {
  try {
    const { public_token, account_id } = req.body as ExchangeTokenRequest;
    
    if (!public_token) {
      return res.status(400).json({ 
        error: 'public_token is required',
        details: 'Provide public_token in request body'
      });
    }

    // Exchange token
    const { accessToken, itemId, accounts } = await exchangePublicToken(public_token);
    
    if (account_id) {
      // Link to existing account
      const account = await prisma.account.findUnique({
        where: { id: account_id }
      });
      
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      // Store access token securely in metadata
      const existingMetadata = (account.metadata as AccountMetadata) || {};
      await prisma.account.update({
        where: { id: account_id },
        data: {
          metadata: {
            ...existingMetadata,
            plaid_access_token: accessToken,
            plaid_item_id: itemId,
            plaid_account_id: accounts[0]?.id,
            last_sync_date: new Date().toISOString(),
          }
        }
      });
      
      logger.info(`Account ${account_id} linked to Plaid item ${itemId}`);
    }
    
    res.json({ 
      success: true,
      item_id: itemId,
      accounts,
      message: 'Token exchanged successfully'
    });
  } catch (error) {
    logger.error('Error in /link/exchange:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/plaid/sync/:accountId
 * Sync transactions from Plaid for specific account
 */
router.post('/sync/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { start_date, end_date } = req.body as SyncRequest;
    
    // Get account with Plaid credentials
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { provider: true }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Type-safe metadata access
    const metadata = account.metadata as AccountMetadata;
    const accessToken = metadata?.plaid_access_token;
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Account not linked to Plaid',
        details: 'Call POST /api/plaid/link/exchange first to link account'
      });
    }
    
    // Default to last 30 days if dates not provided
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    logger.info(`Syncing transactions for account ${accountId} from ${startDate} to ${endDate}`);
    
    // Fetch from Plaid
    const plaidTransactions = await fetchPlaidTransactions(
      accessToken,
      startDate,
      endDate
    );
    
    // Transform to your format
    const transformedTransactions = plaidTransactions.map(transformPlaidTransaction);
    
    // Ingest into your system
    if (transformedTransactions.length > 0) {
      const { stableHashV1 } = await import('../lib/hash.js');
      const { normalizeRaw } = await import('../services/normalize.js');
      const { linkTransfers } = await import('../services/transferDetect.js');
      const { postToLedger } = await import('../services/ledger.js');
      const { classifyTransaction } = await import('../services/classify.js');
      
      let ingested = 0;
      
      for (const txn of transformedTransactions) {
        try {
          const dateISO = txn.timestamp_posted.slice(0, 10);
          const hashV1 = stableHashV1({
            providerId: account.providerId,
            accountId,
            dateISO,
            amountCents: Math.round(txn.amount * 100),
            description: txn.description_raw,
            currency: txn.currency
          });

          let raw = await prisma.rawTransaction.findFirst({
            where: {
              OR: [
                { providerId: account.providerId, accountId, hashV1 },
                txn.provider_tx_id ? { 
                  providerId: account.providerId, 
                  providerTxId: txn.provider_tx_id 
                } : { id: 'never-matches' }
              ]
            }
          });

          if (!raw) {
            raw = await prisma.rawTransaction.create({
              data: {
                providerId: account.providerId,
                accountId,
                hashV1,
                providerTxId: txn.provider_tx_id,
                timestampPosted: txn.timestamp_posted ? new Date(txn.timestamp_posted) : null,
                timestampAuth: txn.timestamp_auth ? new Date(txn.timestamp_auth) : null,
                amount: txn.amount,
                currency: txn.currency,
                descriptionRaw: txn.description_raw,
                counterpartyRaw: txn.counterparty_raw,
                metaJson: txn.meta_json ? JSON.stringify(txn.meta_json) : undefined
              }
            });
          }

          const canonical = await normalizeRaw(raw);
          await linkTransfers(canonical.accountId, canonical.postedAt);
          await postToLedger(canonical.id);
          await classifyTransaction(canonical.id);
          
          ingested++;
        } catch (err) {
          logger.error(`Failed to ingest transaction ${txn.provider_tx_id}:`, err);
        }
      }
      
      const ingestResult = { ok: true, count: ingested };
      
      // Update last sync date
      await prisma.account.update({
        where: { id: accountId },
        data: {
          metadata: {
            ...metadata,
            last_sync_date: new Date().toISOString(),
          }
        }
      });
      
      logger.info(`Successfully synced ${ingestResult.count} transactions`);
      
      res.json({
        success: true,
        synced: transformedTransactions.length,
        ingested: ingestResult.count,
        start_date: startDate,
        end_date: endDate,
        transactions: transformedTransactions
      });
    } else {
      res.json({
        success: true,
        synced: 0,
        ingested: 0,
        start_date: startDate,
        end_date: endDate,
        message: 'No transactions found in date range'
      });
    }
  } catch (error) {
    logger.error('Error in /sync/:accountId:', error);
    res.status(500).json({ 
      error: 'Failed to sync transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/plaid/balance/:accountId
 * Get current balance from Plaid
 */
router.get('/balance/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const metadata = account.metadata as AccountMetadata;
    const accessToken = metadata?.plaid_access_token;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Account not linked to Plaid' });
    }
    
    const balances = await getPlaidBalance(accessToken);
    
    res.json({
      success: true,
      balances
    });
  } catch (error) {
    logger.error('Error in /balance/:accountId:', error);
    res.status(500).json({ 
      error: 'Failed to fetch balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/plaid/webhook
 * Handle Plaid webhook notifications
 */
router.post('/webhook', async (req, res) => {
  try {
    await handlePlaidWebhook(req.body);
    
    // Always respond 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Plaid webhook:', error);
    // Still return 200 to prevent Plaid from retrying
    res.json({ received: true, error: 'Processing failed' });
  }
});

/**
 * DELETE /api/plaid/unlink/:accountId
 * Disconnect account from Plaid
 */
router.delete('/unlink/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const metadata = account.metadata as AccountMetadata;
    const accessToken = metadata?.plaid_access_token;
    
    if (accessToken) {
      // Remove from Plaid
      await removeItem(accessToken);
    }
    
    // Clear metadata
    const { plaid_access_token, plaid_item_id, plaid_account_id, ...restMetadata } = metadata;
    
    await prisma.account.update({
      where: { id: accountId },
      data: {
        metadata: restMetadata
      }
    });
    
    logger.info(`Account ${accountId} unlinked from Plaid`);
    
    res.json({ 
      success: true,
      message: 'Account unlinked from Plaid'
    });
  } catch (error) {
    logger.error('Error in /unlink/:accountId:', error);
    res.status(500).json({ 
      error: 'Failed to unlink account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;