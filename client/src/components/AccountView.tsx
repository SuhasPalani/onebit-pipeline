import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';

export function AccountView() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      
      // Fetch account details
      const accountRes = await api.get(`/accounts/${accountId}`);
      setAccount(accountRes.data);
      
      // Fetch transactions for this account
      const txnRes = await api.get(`/transactions?account_id=${accountId}&limit=100`);
      setTransactions(txnRes.data);
      
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await api.post(`/plaid/sync/${accountId}`, {
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      });

      alert(`Synced ${response.data.synced || 0} transactions`);
      await fetchAccountData(); // Refresh data
    } catch (err: any) {
      alert('Sync failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchAccountData();
    }
  }, [accountId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-600">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-2 text-red-600 hover:underline"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-600">Account not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
          >
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        </div>

        {/* Account Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {account.displayName || 'Unnamed Account'}
              </h1>
              <div className="flex gap-4 text-sm text-gray-600">
                <span>
                  {account.provider?.name || 'Unknown Provider'}
                </span>
                <span>•</span>
                <span>{account.accountType}</span>
                {account.mask && (
                  <>
                    <span>•</span>
                    <span>••{account.mask}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              <p className={`text-lg font-semibold ${account.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {account.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold">
                {account._count?.canonicalTxns || transactions.length}
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-gray-500">Currency</p>
              <p className="text-2xl font-bold">{account.currency}</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-sm text-gray-500">Raw Transactions</p>
              <p className="text-2xl font-bold">
                {account._count?.rawTransactions || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
            <p className="text-sm text-gray-500 mt-1">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No transactions found</p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {syncing ? 'Syncing...' : 'Sync Transactions Now'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
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
                            <p className="text-gray-500 text-xs">
                              {txn.counterpartyNorm}
                            </p>
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
                        <span
                          className={
                            Number(txn.amount) < 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }
                        >
                          {formatCurrency(txn.amount, txn.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            txn.status === 'posted'
                              ? 'bg-green-100 text-green-800'
                              : txn.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
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