import { useState, useEffect } from 'react';

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
      body: JSON.stringify(data || {})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  put: async (url: string, data?: any) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(date: string | number | Date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Account = {
  id: string;
  displayName?: string;
  accountType?: string;
  isActive?: boolean;
  provider?: { name?: string };
  _count?: { canonicalTxns?: number };
  currency?: string;
};

type Transaction = {
  id: string;
  accountId: string;
  descriptionNorm: string;
  counterpartyNorm?: string;
  amount: number;
  postedAt: string;
  status: string;
  classification?: {
    category?: {
      name: string;
    };
  };
};

type Transfer = {
  id: string;
  detectionMethod: string;
  confidence: number;
  txnOut: {
    descriptionNorm: string;
    amount: number;
    postedAt: string;
    account: { displayName?: string };
  };
  txnIn: {
    descriptionNorm: string;
    amount: number;
    postedAt: string;
    account: { displayName?: string };
  };
};

type Category = {
  id: string;
  name: string;
  gaapMap?: string;
  _count?: { classifications?: number };
};

type UnclassifiedItem = {
  txnId: string;
  transaction: {
    descriptionNorm?: string;
    amount: number;
    postedAt: string;
  };
  category?: {
    name: string;
  };
  confidence: number;
};

type Reconciliation = {
  id: string;
  account: { displayName?: string; provider?: { name?: string } };
  accountId: string;
  asOfDate: string;
  systemBalance: number;
  institutionBalance: number;
  delta: number;
  status: string;
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800'
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level]}`}>
      {level.toUpperCase()} ({(confidence * 100).toFixed(0)}%)
    </span>
  );
}

function ReconciliationDetail({ reconciliation, onClose, onTriggerBackfill }: { 
  reconciliation: Reconciliation; 
  onClose: () => void;
  onTriggerBackfill: (accountId: string) => void;
}) {
  const getDriftExplanation = (recon: Reconciliation) => {
    const delta = recon.delta;
    
    if (delta < 0) {
      return `Missing ${formatCurrency(Math.abs(delta))} in transactions. Possible causes: Pending transactions not synced, provider lag, or manual adjustment needed.`;
    } else {
      return `Excess ${formatCurrency(delta)} in ledger. Possible causes: Duplicate transactions, refund not processed, or timing mismatch.`;
    }
  };

  const hasDrift = Math.abs(reconciliation.delta) > 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold">
              {reconciliation.account.displayName} Reconciliation
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Visual Balance Comparison */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 p-4 rounded">
              <div className="text-sm text-gray-600 font-medium">System Balance</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">
                {formatCurrency(reconciliation.systemBalance)}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                From ledger entries
              </div>
            </div>
            
            <div className="border-l-4 border-green-500 pl-4 bg-green-50 p-4 rounded">
              <div className="text-sm text-gray-600 font-medium">Bank Balance</div>
              <div className="text-3xl font-bold text-green-600 mt-2">
                {formatCurrency(reconciliation.institutionBalance)}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                From {reconciliation.account.provider?.name || 'institution'}
              </div>
            </div>
          </div>
          
          {/* Drift Analysis */}
          <div className={`p-4 rounded-lg mb-6 ${
            hasDrift
              ? 'bg-red-50 border-2 border-red-200' 
              : 'bg-green-50 border-2 border-green-200'
          }`}>
            <div className="flex items-start gap-4">
              <div className="text-4xl">
                {hasDrift ? '⚠️' : '✅'}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg mb-2">
                  {hasDrift
                    ? `Drift Detected: ${formatCurrency(Math.abs(reconciliation.delta))}` 
                    : 'Balanced ✓'
                  }
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {hasDrift
                    ? getDriftExplanation(reconciliation)
                    : 'System and institution balances match within $1.00'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation Details */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Reconciliation Date:</span>
                <span className="ml-2 font-medium">{formatDate(reconciliation.asOfDate)}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  reconciliation.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {reconciliation.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          {hasDrift && (
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                onClick={() => {
                  onTriggerBackfill(reconciliation.accountId);
                  onClose();
                }}
              >
                🔄 Trigger Backfill Sync
              </button>
              <button 
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
                onClick={() => alert('Investigate feature would show transaction-level analysis')}
              >
                🔍 Investigate Transactions
              </button>
              <button 
                className="px-4 py-2 border-2 border-gray-300 rounded hover:bg-gray-50 font-medium"
                onClick={() => {
                  alert('Marked as resolved');
                  onClose();
                }}
              >
                ✓ Mark as Resolved
              </button>
            </div>
          )}

          {!hasDrift && (
            <button 
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
      {message}
    </div>
  );
}

export default function OneBitDemo() {
  const [view, setView] = useState<string>('overview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unclassified, setUnclassified] = useState<UnclassifiedItem[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedReconciliation, setSelectedReconciliation] = useState<Reconciliation | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accts, txns, xfers, cats, unclass, recon] = await Promise.all([
        api.get('/accounts'),
        api.get('/transactions?limit=100'),
        api.get('/transfers'),
        api.get('/classifications/categories'),
        api.get('/classifications/unclassified?threshold=0.6'),
        api.get('/reconciliation?limit=20')
      ]);
      
      setAccounts(accts);
      setTransactions(txns);
      setTransfers(xfers);
      setCategories(cats);
      setUnclassified(unclass);
      setReconciliations(recon);
    } catch (err) {
      console.error('Failed to load data:', err);
      setToast('❌ Failed to load data');
    }
  };

  const runReconciliation = async (accountId: string) => {
    try {
      await api.post(`/reconciliation/account/${accountId}`, {});
      await loadData();
      setToast('✅ Reconciliation complete!');
    } catch (err) {
      if (err instanceof Error) {
        setToast('❌ Reconciliation failed: ' + err.message);
      } else {
        setToast('❌ Reconciliation failed');
      }
    }
  };

  const handleCategoryChange = async (txnId: string, categoryId: string) => {
    setUpdating(true);
    try {
      await api.put(`/classifications/transaction/${txnId}`, {
        category_id: categoryId,
        confidence: 1.0,
        locked_by_user: true,
        explanations: { 
          method: 'manual_override', 
          user: 'demo_user',
          timestamp: new Date().toISOString() 
        }
      });
      
      setToast('✅ Category updated and locked!');
      await loadData();
    } catch (err) {
      setToast('❌ Failed to update category');
    } finally {
      setUpdating(false);
    }
  };

  // Overview Stats
  const totalTransactions = accounts.reduce((sum, a) => sum + (a._count?.canonicalTxns || 0), 0);

  // Views
  if (view === 'overview') {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-2xl font-bold">OneBit Pipeline Demo</h1>
          <p className="text-sm text-gray-600">Transaction processing, classification, transfers & reconciliation</p>
        </div>

        {/* Nav */}
        <div className="bg-white border-b px-6 py-3 flex gap-4">
          {['overview', 'accounts', 'transactions', 'transfers', 'classifications', 'reconciliation'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 rounded font-medium ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <button onClick={loadData} className="ml-auto px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
            ↻ Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="p-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600">{accounts.length}</div>
            <div className="text-sm text-gray-600 mt-1 font-medium">Total Accounts</div>
            <div className="text-xs text-gray-500 mt-2">
              {accounts.filter(a => a.isActive).length} active
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600">{totalTransactions}</div>
            <div className="text-sm text-gray-600 mt-1 font-medium">Total Transactions</div>
            <div className="text-xs text-gray-500 mt-2">
              {transactions.filter(t => t.status === 'pending').length} pending
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">{transfers.length}</div>
            <div className="text-sm text-gray-600 mt-1 font-medium">Transfer Links</div>
            <div className="text-xs text-gray-500 mt-2">
              Auto-detected transfers
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-orange-600">{unclassified.length}</div>
            <div className="text-sm text-gray-600 mt-1 font-medium">Needs Review</div>
            <div className="text-xs text-gray-500 mt-2">
              Low confidence classifications
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-4">
          {/* Recent Transactions */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b font-semibold">Recent Transactions</div>
            <div className="p-4 space-y-2">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{t.descriptionNorm}</div>
                    <div className="text-xs text-gray-500">{formatDate(t.postedAt)}</div>
                  </div>
                  <div className={`font-semibold ${Number(t.amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Number(t.amount))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b font-semibold">Top Categories</div>
            <div className="p-4 space-y-2">
              {categories.slice(0, 5).map(cat => (
                <div key={cat.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="text-sm">{cat.name}</div>
                  <div className="text-sm font-semibold text-gray-600">
                    {cat._count?.classifications || 0} txns
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'accounts') {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        
        <div className="bg-white border-b px-6 py-4">
          <button onClick={() => setView('overview')} className="text-blue-600 mb-2 hover:underline">← Back</button>
          <h1 className="text-2xl font-bold">Accounts ({accounts.length})</h1>
        </div>
        
        <div className="p-6 grid grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold">{acc.displayName || 'Unnamed'}</div>
                  <div className="text-xs text-gray-500">{acc.accountType}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${acc.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                  {acc.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Provider:</span>
                  <span className="font-medium">{acc.provider?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transactions:</span>
                  <span className="font-medium">{acc._count?.canonicalTxns || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Currency:</span>
                  <span className="font-medium">{acc.currency}</span>
                </div>
              </div>

              <button
                onClick={() => runReconciliation(acc.id)}
                className="mt-4 w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 font-medium"
              >
                Run Reconciliation
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'transactions') {
    const filtered = selectedAccount 
      ? transactions.filter(t => t.accountId === selectedAccount)
      : transactions;

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <button onClick={() => setView('overview')} className="text-blue-600 mb-2 hover:underline">← Back</button>
          <h1 className="text-2xl font-bold">Transactions ({filtered.length})</h1>
          
          <select 
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="mt-2 px-3 py-2 border rounded"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.displayName || 'Unnamed'}</option>
            ))}
          </select>
        </div>
        
        <div className="p-6">
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
                {filtered.slice(0, 50).map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(t.postedAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{t.descriptionNorm}</div>
                      {t.counterpartyNorm && (
                        <div className="text-xs text-gray-500">{t.counterpartyNorm}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t.classification?.category?.name ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {t.classification.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Uncategorized</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      <span className={Number(t.amount) > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(Number(t.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'transfers') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <button onClick={() => setView('overview')} className="text-blue-600 mb-2 hover:underline">← Back</button>
          <h1 className="text-2xl font-bold">Transfer Links ({transfers.length})</h1>
          <p className="text-sm text-gray-600 mt-1">Auto-detected transfers prevent double-counting</p>
        </div>
        
        <div className="p-6 space-y-4">
          {transfers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No transfers detected yet
            </div>
          ) : (
            transfers.map(xfer => (
              <div key={xfer.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-r pr-4">
                    <div className="text-xs text-gray-500 uppercase mb-2 font-medium">Outgoing</div>
                    <div className="font-medium">{xfer.txnOut.descriptionNorm}</div>
                    <div className="text-sm text-gray-600">{xfer.txnOut.account.displayName}</div>
                    <div className="text-red-600 font-semibold mt-2">
                      {formatCurrency(Number(xfer.txnOut.amount))}
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(xfer.txnOut.postedAt)}</div>
                  </div>
                  <div className="pl-4">
                    <div className="text-xs text-gray-500 uppercase mb-2 font-medium">Incoming</div>
                    <div className="font-medium">{xfer.txnIn.descriptionNorm}</div>
                    <div className="text-sm text-gray-600">{xfer.txnIn.account.displayName}</div>
                    <div className="text-green-600 font-semibold mt-2">
                      {formatCurrency(Number(xfer.txnIn.amount))}
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(xfer.txnIn.postedAt)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-sm text-gray-600">
                  <span>Method: <b>{xfer.detectionMethod}</b></span>
                  <span>Confidence: <b>{(xfer.confidence * 100).toFixed(0)}%</b></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'classifications') {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        
        <div className="bg-white border-b px-6 py-4">
          <button onClick={() => setView('overview')} className="text-blue-600 mb-2 hover:underline">← Back</button>
          <h1 className="text-2xl font-bold">Classifications</h1>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Unclassified */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b font-semibold">
              Low Confidence - Needs Review ({unclassified.length})
            </div>
            <div className="p-4 space-y-3">
              {unclassified.length === 0 ? (
                <div className="text-center text-gray-500 py-4">✅ All transactions classified!</div>
              ) : (
                unclassified.map(item => (
                  <div key={item.txnId} className="border rounded p-4 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{item.transaction.descriptionNorm}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formatCurrency(Number(item.transaction.amount))} • {formatDate(item.transaction.postedAt)}
                        </div>
                        {item.category && (
                          <div className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                            <span>Current: {item.category.name}</span>
                            <ConfidenceBadge confidence={item.confidence} />
                          </div>
                        )}
                      </div>
                      <select 
                        className="border-2 rounded px-3 py-2 text-sm min-w-[200px] disabled:opacity-50"
                        disabled={updating}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleCategoryChange(item.txnId, e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Change Category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b font-semibold">
              All Categories ({categories.length})
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="border rounded p-3 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      {cat.gaapMap && (
                        <div className="text-xs text-gray-500 mt-1">{cat.gaapMap}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 font-semibold">
                      {cat._count?.classifications || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'reconciliation') {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        {selectedReconciliation && (
          <ReconciliationDetail 
            reconciliation={selectedReconciliation} 
            onClose={() => setSelectedReconciliation(null)}
            onTriggerBackfill={runReconciliation}
          />
        )}
        
        <div className="bg-white border-b px-6 py-4">
          <button onClick={() => setView('overview')} className="text-blue-600 mb-2 hover:underline">← Back</button>
          <h1 className="text-2xl font-bold">Reconciliation ({reconciliations.length})</h1>
          <p className="text-sm text-gray-600 mt-1">Click any row to see detailed analysis</p>
        </div>
        
        <div className="p-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">System</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Institution</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reconciliations.map(r => (
                  <tr 
                    key={r.id} 
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedReconciliation(r)}
                  >
                    <td className="px-4 py-3 text-sm font-medium">{r.account.displayName}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(r.asOfDate)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(Number(r.systemBalance))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(Number(r.institutionBalance))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      <span className={Math.abs(Number(r.delta)) > 1 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Number(r.delta))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        r.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="font-semibold text-sm mb-2">💡 Understanding Reconciliation</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div><strong>System Balance:</strong> Calculated from your transaction ledger</div>
              <div><strong>Institution Balance:</strong> Reported by the financial institution</div>
              <div><strong>Delta:</strong> Difference between the two (System - Institution)</div>
              <div className="pt-2 border-t border-blue-200 mt-2">
                <strong>Status:</strong> 
                <span className="ml-2">✅ OK = Balanced within $1.00</span>
                <span className="ml-4">⚠️ Drift = Mismatch exceeds $1.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}