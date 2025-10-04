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
          user_id: 'user-123'
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
      console.log('Metadata:', metadata);
      
      let finalAccountId = accountId;

      // If no accountId provided, create new account first
      if (!accountId) {
        // Get Plaid provider
        const providersResponse = await api.get('/accounts');
        const accounts = Array.isArray(providersResponse.data) ? providersResponse.data : [];
        const plaidProvider = accounts.find((acc: any) => 
          acc.provider?.name === 'Plaid'
        )?.provider;

        if (!plaidProvider) {
          throw new Error('Plaid provider not found. Run: cd server && npm run prisma:seed');
        }

        // Create account
        const accountResponse = await api.post('/accounts', {
          user_id: 'user-123',
          provider_id: plaidProvider.id,
          institution_id: metadata.institution?.institution_id || 'plaid_institution',
          account_type: metadata.accounts?.[0]?.subtype || 'bank_checking',
          currency: 'USD',
          mask: metadata.accounts?.[0]?.mask || '',
          display_name: metadata.accounts?.[0]?.name || metadata.institution?.name || 'Plaid Account'
        });

        finalAccountId = accountResponse.data.id;
        console.log('Created account:', finalAccountId);
      }

      
      // Exchange token and link to account
      const exchangeResponse = await api.post('/plaid/link/exchange', {
        public_token,
        account_id: finalAccountId
      });

      console.log('Token exchanged:', exchangeResponse.data);

      // 🔄 Add delay here to allow Plaid to prepare transaction data
      console.log('Waiting 3 seconds before syncing transactions...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Now trigger initial sync
      if (!finalAccountId) {
        throw new Error('Failed to get account ID');
      }

      console.log('Syncing transactions for account:', finalAccountId);
      const syncResponse = await api.post(`/plaid/sync/${finalAccountId}`, {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      });

      
      console.log('Sync complete:', syncResponse.data);
      onSuccess(finalAccountId);
    } catch (error: any) {
      console.error('Error in Plaid flow:', error);
      console.error('Error details:', error.response?.data);
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