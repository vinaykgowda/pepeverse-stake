// frontend/src/components/Admin/ClaimsAnalytics.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const ClaimsAnalytics = () => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ total_claims: 0, unique_wallets: 0, by_token: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ start_date: '', end_date: '', wallet_address: '' });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 50;

  const fetchClaims = useCallback(async (activeFilters, currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...activeFilters, page: currentPage, limit: LIMIT };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await api.admin.getClaimsAnalytics(params);
      const data = res.data.data;
      setClaims(data?.records || []);
      if (data?.stats) setStats(data.stats);
      if (data?.total != null) setTotalPages(Math.ceil(data.total / LIMIT) || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load claims analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClaims(appliedFilters, page); }, [appliedFilters, page, fetchClaims]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = { ...appliedFilters, export: 'csv' };
      Object.keys(params).forEach(k => { if (!params[k] && params[k] !== 'csv') delete params[k]; });
      const res = await api.admin.getClaimsAnalytics(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'claims-export.csv';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { setError('Failed to export CSV'); } finally { setExporting(false); }
  };

  const formatDate = (ts) => ts ? new Date(ts).toLocaleString() : '—';
  const truncateHash = (h) => h ? `${h.slice(0,8)}...${h.slice(-6)}` : '—';

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Claims Analytics</h2>
        <button onClick={handleExportCSV} disabled={exporting}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300">
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" name="start_date" value={filters.start_date}
              onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" name="end_date" value={filters.end_date}
              onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
            <input type="text" value={filters.wallet_address} placeholder="Filter by wallet"
              onChange={e => setFilters(p => ({ ...p, wallet_address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setPage(1); setAppliedFilters({ ...filters }); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Apply Filters</button>
          <button onClick={() => { const e = { start_date: '', end_date: '', wallet_address: '' }; setFilters(e); setPage(1); setAppliedFilters({}); }}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Clear</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-500">Total Claims</p>
          <p className="text-2xl font-bold text-gray-900">{(stats.total_claims ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-500">Unique Wallets</p>
          <p className="text-2xl font-bold text-gray-900">{(stats.unique_wallets ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Per-token breakdown */}
      {stats.by_token && stats.by_token.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tokens Distributed</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.by_token.map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-semibold text-indigo-600 uppercase">{t.token_symbol}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{Number(t.total_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                <p className="text-xs text-gray-500">{t.claim_count} claim{t.claim_count !== 1 ? 's' : ''}</p>
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
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {claims.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No claims found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {claims.map((claim, idx) => (
                      <tr key={claim.id || idx} className="hover:bg-gray-50">
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
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <p className="text-sm text-gray-700">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">Previous</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">Next</button>
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

export default ClaimsAnalytics;
