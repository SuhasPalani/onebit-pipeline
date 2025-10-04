import { useState, useEffect } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' }
});

function formatCurrency(amount: number | string, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(num);
}

interface PlaidLinkProps {
  onSuccess: (accountId: string) => void;
}

function PlaidLink({ onSuccess }: PlaidLinkProps) {
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

  const onPlaidSuccess = async (public_token: string, metadata: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const providersResponse = await api.get('/accounts');
      const accounts = Array.isArray(providersResponse.data) ? providersResponse.data : [];
      const plaidProvider = accounts.find((acc: any) => 
        acc.provider?.name === 'Plaid'
      )?.provider;

      if (!plaidProvider) {
        throw new Error('Plaid provider not found');
      }

      const accountResponse = await api.post('/accounts', {
        user_id: 'user-123',
        provider_id: plaidProvider.id,
        institution_id: metadata.institution?.institution_id || 'plaid_institution',
        account_type: metadata.accounts?.[0]?.subtype || 'bank_checking',
        currency: 'USD',
        mask: metadata.accounts?.[0]?.mask || '',
        display_name: metadata.accounts?.[0]?.name || metadata.institution?.name || 'Plaid Account'
      });

      const finalAccountId = accountResponse.data.id;
      
      await api.post('/plaid/link/exchange', {
        public_token,
        account_id: finalAccountId
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      await api.post(`/plaid/sync/${finalAccountId}`, {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      });

      onSuccess(finalAccountId);
    } catch (error: any) {
      console.error('Error in Plaid flow:', error);
      setError(error.response?.data?.message || error.message || 'Failed to connect account');
    } finally {
      setLoading(false);
    }
  };

  const config = linkToken ? {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err: any) => {
      if (err) {
        console.error('Plaid Link exit:', err);
        setError('Connection cancelled or failed');
      }
    }
  } : null;

  const { open, ready } = (window as any).Plaid?.create?.(config) || { open: () => {}, ready: false };

  return (
    <div className="space-y-2">
      <button
        onClick={() => open()}
        disabled={!ready || loading}
        className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
      >
        {loading ? 'Connecting...' : 'Connect Bank Account via Plaid'}
      </button>
      
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!ready && !error && <div className="text-gray-500 text-sm">Loading Plaid Link...</div>}
    </div>
  );
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/accounts');
      const data = Array.isArray(response.data) ? response.data : [];
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (accountId: string) => {
    try {
      const response = await api.get(`/transactions?account_id=${accountId}&limit=100`);
      setTransactions(response.data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const handleViewDetails = async (account: any) => {
    setSelectedAccount(account);
    await fetchTransactions(account.id);
  };

  const handleSync = async (accountId: string) => {
    try {
      setSyncing(true);
      const response = await api.post(`/plaid/sync/${accountId}`, {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      });

      alert(`Synced ${response.data.synced ?? 0} transactions`);
      await fetchAccounts();
      if (selectedAccount?.id === accountId) {
        await fetchTransactions(accountId);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  if (loading) {
    return <div className="p-6">Loading accounts...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Error loading accounts: {error.message}</div>;
  }

  // Show account details view
  if (selectedAccount) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedAccount(null)}
              className="text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => handleSync(selectedAccount.id)}
              disabled={syncing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              {syncing ? 'Syncing...' : 'Sync Transactions'}
            </button>
          </div>

          {/* Account Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold mb-2">
              {selectedAccount.displayName ?? 'Unnamed Account'}
            </h1>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>{selectedAccount.provider?.name ?? 'Unknown'}</span>
              <span>•</span>
              <span>{selectedAccount.accountType}</span>
              {selectedAccount.mask && (
                <>
                  <span>•</span>
                  <span>••{selectedAccount.mask}</span>
                </>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <p className="text-sm text-gray-500">Currency</p>
                <p className="text-2xl font-bold">{selectedAccount.currency}</p>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <p className="text-sm text-gray-500">Status</p>
                <p className={`text-xl font-bold ${selectedAccount.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedAccount.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Transactions</h2>
              <p className="text-sm text-gray-500 mt-1">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>

            {transactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="mb-4">No transactions found</p>
                <button
                  onClick={() => handleSync(selectedAccount.id)}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  {syncing ? 'Syncing...' : 'Sync Transactions Now'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(txn.postedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            <p className="font-medium">{txn.descriptionNorm}</p>
                            {txn.counterpartyNorm && (
                              <p className="text-gray-500 text-xs">{txn.counterpartyNorm}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {txn.classification?.category?.name ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {txn.classification.category.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Uncategorized</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          <span className={Number(txn.amount) < 0 ? 'text-red-600' : 'text-green-600'}>
                            {formatCurrency(txn.amount, txn.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            txn.status === 'posted' ? 'bg-green-100 text-green-800' :
                            txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show main dashboard
  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Plaid Connection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-3">Connect Bank Account</h2>
        <p className="text-gray-600 mb-4">
          Link your bank account securely through Plaid to automatically sync transactions.
        </p>
        <PlaidLink onSuccess={fetchAccounts} />
      </div>

      {/* Accounts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
        </div>
        <div className="p-6">
          {accounts.length === 0 ? (
            <p className="text-gray-500">No accounts found. Connect a bank account to get started.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account: any) => (
                <div key={account.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{account.displayName ?? 'Unnamed Account'}</h3>
                      <p className="text-sm text-gray-500">
                        {account.provider?.name ?? 'Unknown'} • {account.accountType}
                      </p>
                    </div>
                    {account.mask && <span className="text-xs bg-gray-100 px-2 py-1 rounded">••{account.mask}</span>}
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-xs text-gray-500">Transactions</p>
                    <p className="text-lg font-semibold">{account._count?.canonicalTxns ?? 0}</p>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button 
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => handleViewDetails(account)}
                    >
                      View Details
                    </button>
                    {account.metadata?.plaid_access_token && (
                      <button 
                        className="text-sm text-green-600 hover:underline"
                        onClick={() => handleSync(account.id)}
                        disabled={syncing}
                      >
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 mb-1">Total Accounts</h3>
          <p className="text-2xl font-bold">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 mb-1">Active Accounts</h3>
          <p className="text-2xl font-bold">{accounts.filter((a: any) => a.isActive).length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 mb-1">Total Transactions</h3>
          <p className="text-2xl font-bold">
            {accounts.reduce((sum: number, a: any) => sum + (a._count?.canonicalTxns ?? 0), 0)}
          </p>
        </div>
      </div>
    </div>
  );
}