import { useState, useEffect } from 'react';

// API configuration
const API_BASE = 'http://localhost:3001/api';

const api = {
  get: async (url: string) => {
    const res = await fetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  post: async (url: string, data?: any) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Accounts Tab
function AccountsTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.get('/accounts');
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading accounts...</div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Accounts</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-lg">{acc.displayName || 'Unnamed'}</h3>
            <p className="text-sm text-gray-600">{acc.provider?.name} • {acc.accountType}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Currency:</span>
                <span className="font-medium">{acc.currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transactions:</span>
                <span className="font-medium">{acc._count?.canonicalTxns || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${acc.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {acc.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Transactions Tab
function TransactionsTab() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [selectedAccount]);

  const loadAccounts = async () => {
    const data = await api.get('/accounts');
    setAccounts(Array.isArray(data) ? data : []);
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const url = selectedAccount 
        ? `/transactions?account_id=${selectedAccount}&limit=100`
        : `/transactions?limit=100`;
      const data = await api.get(url);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Accounts</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.displayName || 'Unnamed Account'}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No transactions found</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map(txn => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{formatDate(txn.postedAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{txn.descriptionNorm}</div>
                    {txn.counterpartyNorm && (
                      <div className="text-xs text-gray-500">{txn.counterpartyNorm}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {txn.classification?.category?.name ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {txn.classification.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    <span className={Number(txn.amount) < 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Number(txn.amount), txn.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      txn.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
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
  );
}

// Classifications Tab
function ClassificationsTab() {
  const [unclassified, setUnclassified] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [unclassData, catData] = await Promise.all([
        api.get('/classifications/unclassified?threshold=0.6'),
        api.get('/classifications/categories')
      ]);
      setUnclassified(unclassData);
      setCategories(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = async (txnId: string, categoryId: string) => {
    try {
      await api.put(`/classifications/transaction/${txnId}`, {
        category_id: categoryId,
        confidence: 1.0,
        locked_by_user: true,
        explanations: { method: 'manual' }
      });
      await loadData();
      alert('Classification updated!');
    } catch (err) {
      alert('Failed to update classification');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Low Confidence Classifications</h2>
        {unclassified.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">All transactions are classified!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unclassified.map(item => (
              <div key={item.txnId} className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{item.transaction.descriptionNorm}</p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(Number(item.transaction.amount))} • {formatDate(item.transaction.postedAt)}
                    </p>
                    {item.category && (
                      <p className="text-sm text-gray-500 mt-1">
                        Current: {item.category.name} (confidence: {(item.confidence * 100).toFixed(0)}%)
                      </p>
                    )}
                  </div>
                  <select
                    onChange={(e) => handleClassify(item.txnId, e.target.value)}
                    className="border rounded px-3 py-2 ml-4"
                    defaultValue=""
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">All Categories</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{cat.name}</p>
                  {cat.gaapMap && (
                    <p className="text-xs text-gray-500 mt-1">{cat.gaapMap}</p>
                  )}
                </div>
                <span className="text-sm text-gray-600">
                  {cat._count?.classifications || 0} txns
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Transfers Tab
function TransfersTab() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      const data = await api.get('/transfers');
      setTransfers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Transfer Links</h2>
      {transfers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No transfers detected yet</div>
      ) : (
        <div className="space-y-4">
          {transfers.map(transfer => (
            <div key={transfer.id} className="bg-white border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-r pr-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Outgoing</p>
                  <p className="font-medium">{transfer.txnOut.descriptionNorm}</p>
                  <p className="text-sm text-gray-600">{transfer.txnOut.account.displayName}</p>
                  <p className="text-red-600 font-medium mt-1">
                    {formatCurrency(Number(transfer.txnOut.amount))}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(transfer.txnOut.postedAt)}</p>
                </div>
                <div className="pl-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Incoming</p>
                  <p className="font-medium">{transfer.txnIn.descriptionNorm}</p>
                  <p className="text-sm text-gray-600">{transfer.txnIn.account.displayName}</p>
                  <p className="text-green-600 font-medium mt-1">
                    {formatCurrency(Number(transfer.txnIn.amount))}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(transfer.txnIn.postedAt)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                <span className="text-gray-600">
                  Method: <span className="font-medium">{transfer.detectionMethod}</span>
                </span>
                <span className="text-gray-600">
                  Confidence: <span className="font-medium">{(transfer.confidence * 100).toFixed(0)}%</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reconciliation Tab
function ReconciliationTab() {
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reconData, accData] = await Promise.all([
        api.get('/reconciliation?limit=50'),
        api.get('/accounts')
      ]);
      setReconciliations(reconData);
      setAccounts(Array.isArray(accData) ? accData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runReconciliation = async (accountId: string) => {
    try {
      setRunning(true);
      await api.post(`/reconciliation/account/${accountId}`);
      await loadData();
      alert('Reconciliation completed!');
    } catch (err) {
      alert('Reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Run Reconciliation</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white border rounded-lg p-4">
              <p className="font-medium">{acc.displayName || 'Unnamed'}</p>
              <p className="text-sm text-gray-600 mb-3">{acc.accountType}</p>
              <button
                onClick={() => runReconciliation(acc.id)}
                disabled={running}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                {running ? 'Running...' : 'Reconcile'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Reconciliation History</h2>
        {reconciliations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No reconciliations yet</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">System Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Institution Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reconciliations.map(recon => (
                  <tr key={recon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{recon.account.displayName}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(recon.asOfDate)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(Number(recon.systemBalance), recon.account.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {formatCurrency(Number(recon.institutionBalance), recon.account.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      <span className={Math.abs(Number(recon.delta)) > 1 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Number(recon.delta), recon.account.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        recon.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {recon.status}
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
  );
}

// Main Dashboard
export default function CompleteDashboard() {
  const [activeTab, setActiveTab] = useState('accounts');

  const tabs = [
    { id: 'accounts', label: 'Accounts', component: AccountsTab },
    { id: 'transactions', label: 'Transactions', component: TransactionsTab },
    { id: 'classifications', label: 'Classifications', component: ClassificationsTab },
    { id: 'transfers', label: 'Transfers', component: TransfersTab },
    { id: 'reconciliation', label: 'Reconciliation', component: ReconciliationTab }
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || AccountsTab;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold mb-4">OneBit Transaction Pipeline</h1>
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto">
        <ActiveComponent />
      </div>
    </div>
  );
}