// client/src/components/PlaidLink.tsx
import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from './ui/Button';
import api from '../services/api';

interface PlaidLinkProps {
  onSuccess: (accountId: string) => void;
  accountId?: string;
}

export function PlaidLink({ onSuccess, accountId }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const response = await api.post('/plaid/link/token', {
          user_id: 'user-123' // Replace with actual user ID from auth
        });
        setLinkToken(response.data.link_token);
      } catch (error: any) {
        console.error('Error creating link token:', error);
        setError(error.response?.data?.message || 'Failed to create link token');
      }
    };
    createLinkToken();
  }, []);

  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Plaid Link success, exchanging token...');
      
      // Exchange public token
      const exchangeResponse = await api.post('/plaid/link/exchange', {
        public_token,
        account_id: accountId || '' // Will create new account if not provided
      });

      console.log('Token exchanged:', exchangeResponse.data);

      // Get the provider ID (Plaid)
      const providersResponse = await api.get('/accounts');
      const plaidProvider = providersResponse.data.find((acc: any) => 
        acc.provider?.name === 'Plaid'
      )?.provider;

      if (!plaidProvider) {
        throw new Error('Plaid provider not found');
      }

      let finalAccountId = accountId;

      // Create new account if not provided
      if (!accountId && exchangeResponse.data.accounts?.[0]) {
        const plaidAccount = exchangeResponse.data.accounts[0];
        
        const accountResponse = await api.post('/accounts', {
          user_id: 'user-123',
          provider_id: plaidProvider.id,
          institution_id: metadata.institution?.institution_id || 'plaid_institution',
          account_type: plaidAccount.subtype || plaidAccount.type || 'bank_checking',
          currency: 'USD',
          mask: plaidAccount.mask || '',
          display_name: plaidAccount.name || 'Plaid Account'
        });

        finalAccountId = accountResponse.data.id;
        console.log('Created account:', finalAccountId);

        // Now update with Plaid metadata
        await api.post('/plaid/link/exchange', {
          public_token,
          account_id: finalAccountId
        });
      }

      // Trigger initial sync
      if (finalAccountId) {
        console.log('Syncing transactions for account:', finalAccountId);
        const syncResponse = await api.post(`/plaid/sync/${finalAccountId}`, {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
        
        console.log('Sync complete:', syncResponse.data);
        onSuccess(finalAccountId);
      }
    } catch (error: any) {
      console.error('Error in Plaid flow:', error);
      setError(error.response?.data?.message || error.message || 'Failed to connect account');
    } finally {
      setLoading(false);
    }
  }, [accountId, onSuccess]);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err: any) => {
      if (err) {
        console.error('Plaid Link exit:', err);
        setError('Connection cancelled or failed');
      }
    }
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <div className="space-y-2">
      <Button 
        onClick={() => open()} 
        disabled={!ready || loading}
      >
        {loading ? 'Connecting...' : 'Connect Bank Account via Plaid'}
      </Button>
      
      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {!ready && !error && (
        <div className="text-gray-500 text-sm">
          Loading Plaid Link...
        </div>
      )}
    </div>
  );
}