import { useAccounts } from '../hooks/useAccounts';
import { PlaidLink } from './PlaidLink';    

export function Dashboard() {
  const { accounts, loading, error, refetch } = useAccounts();

  // For debugging unhandled frontend errors
  window.onerror = function (message, source, lineno, colno, error) {
    console.error("Global error caught:", { message, source, lineno, colno, error });
  };

  if (loading) {
    return <div className="p-6">Loading accounts...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Error loading accounts: {error.message}</div>;
  }

  if (!Array.isArray(accounts)) {
    return <div className="p-6 text-red-600">Invalid account data received.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {/* Plaid Connection Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-3">Connect Bank Account</h2>
        <p className="text-gray-600 mb-4">
          Link your bank account securely through Plaid to automatically sync transactions.
        </p>
        <PlaidLink 
          onSuccess={(accountId) => {
            console.log('Account connected:', accountId);
            refetch();
          }}
        />
      </div>

      {/* Accounts Overview */}
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
                        {account.provider?.name ?? 'Unknown Provider'} • {account.accountType ?? 'Unknown Type'}
                      </p>
                    </div>
                    {account.mask && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        ••{account.mask}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-xs text-gray-500">Transactions</p>
                    <p className="text-lg font-semibold">
                      {account._count?.canonicalTxns ?? 0}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button 
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => window.location.href = `/accounts/${account.id}`}
                    >
                      View Details
                    </button>
                    {account.metadata?.plaid_access_token && (
                      <button 
                        className="text-sm text-green-600 hover:underline"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/plaid/sync/${account.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });

                            const result = await response.json();
                            alert(`Synced ${result.synced ?? 0} transactions`);
                            refetch();
                          } catch (err) {
                            console.error('Sync failed:', err);
                            alert('Sync failed');
                          }
                        }}
                      >
                        Sync Now
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
          <p className="text-2xl font-bold">
            {accounts.filter((a: any) => a.isActive).length}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 mb-1">Total Transactions</h3>
          <p className="text-2xl font-bold">
            {accounts.reduce((sum: number, a: any) => 
              sum + (a._count?.canonicalTxns ?? 0), 0
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
