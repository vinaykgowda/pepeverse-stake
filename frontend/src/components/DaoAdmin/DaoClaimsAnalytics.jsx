// frontend/src/components/DaoAdmin/DaoClaimsAnalytics.jsx
import React, { useState, useEffect, useCallback } from 'react';

const _base = import.meta.env.VITE_API_URL || '';
const API_BASE = _base.endsWith('/api/v1') ? _base.slice(0, -7) : _base;

const DaoClaimsAnalytics = () => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total_claims: 0, unique_wallets: 0, by_token: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', wallet_address: '' });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchClaims = useCallback(async (activeFilters, currentOffset) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: currentOffset });
      Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const res = await fetch(`${API_BASE}/api/v1/dao-admin/analytics/claims?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to load');
      const json = await res.json();
      const data = json.data;
      setClaims(data?.records || []);
      if (data?.stats) setStats(data.stats);
      if (data?.total != null) setTotal(data.total);
    } catch (err) {
      setError(err.message || 'Failed to load DAO claims analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClaims(appliedFilters, offset); }, [appliedFilters, offset, fetchClaims]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const formatDate = (ts) => ts ? new Date(ts).toLocaleString() : '—';
  const truncateHash = (h) => h ? `${h.slice(0, 8)}...${h.slice(-6)}` : '—';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-indigo-900">DAO Claims Analytics</h2>
        <p className="text-sm text-indigo-600 mt-1">DAO_CLAIM transaction history</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-indigo-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">Start Date</label>
            <input type="date" value={filters.start_date}
              onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">End Date</label>
            <input type="date" value={filters.end_date}
              onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">Wallet Address</label>
            <input type="text" value={filters.wallet_address} placeholder="Filter by wallet"
              onChange={e => setFilters(p => ({ ...p, wallet_address: e.target.value }))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setOffset(0); setAppliedFilters({ ...filters }); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Apply Filters</button>
          <button onClick={() => { const e = { start_date: '', end_date: '', wallet_address: '' }; setFilters(e); setOffset(0); setAppliedFilters({}); }}
            className="px-4 py-2 bg-white text-indigo-700 border border-indigo-300 rounded-md hover:bg-indigo-50">Clear</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-500">
          <p className="text-sm font-medium text-indigo-600">Total DAO Claims</p>
          <p className="text-2xl font-bold text-indigo-900">{(stats.total_claims ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <p className="text-sm font-medium text-blue-600">Unique Wallets</p>
          <p className="text-2xl font-bold text-blue-900">{(stats.unique_wallets ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Per-token breakdown */}
      {stats.by_token && stats.by_token.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-indigo-100">
          <h3 className="text-sm font-medium text-indigo-700 mb-3">DAO Tokens Distributed</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.by_token.map((t, i) => (
              <div key={i} className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                <p className="text-xs font-semibold text-indigo-600 uppercase">{t.token_symbol}</p>
                <p className="text-lg font-bold text-indigo-900 mt-1">{Number(t.total_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                <p className="text-xs text-indigo-500">{t.claim_count} claim{t.claim_count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-indigo-100">
          {claims.length === 0 ? (
            <div className="p-12 text-center text-indigo-400">No DAO claims found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-indigo-100">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Wallet Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Token</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-indigo-50">
                    {claims.map((claim, idx) => (
                      <tr key={claim.id || idx} className="hover:bg-indigo-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{claim.wallet_address}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-indigo-700">{claim.token_symbol || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{Number(claim.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(claim.timestamp)}</td>
                        <td className="px-6 py-4 text-sm">
                          {claim.transaction_hash ? (
                            <a href={`https://explorer.solana.com/tx/${claim.transaction_hash}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900 font-mono">
                              {truncateHash(claim.transaction_hash)}
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-indigo-100">
                  <p className="text-sm text-indigo-700">Page {currentPage} of {totalPages} ({total} total)</p>
                  <div className="flex gap-2">
                    <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}
                      className="px-3 py-1 border border-indigo-300 rounded-md text-sm text-indigo-700 disabled:opacity-50 hover:bg-indigo-50">Previous</button>
                    <button onClick={() => setOffset(o => o + LIMIT)} disabled={currentPage >= totalPages}
                      className="px-3 py-1 border border-indigo-300 rounded-md text-sm text-indigo-700 disabled:opacity-50 hover:bg-indigo-50">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DaoClaimsAnalytics;
