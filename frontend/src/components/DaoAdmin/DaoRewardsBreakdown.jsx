// frontend/src/components/DaoAdmin/DaoRewardsBreakdown.jsx
import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const DaoRewardsBreakdown = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletFilter, setWalletFilter] = useState('');
  const [appliedWallet, setAppliedWallet] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchBreakdown = useCallback(async (wallet, currentOffset) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: currentOffset });
      if (wallet) params.append('wallet_address', wallet);
      const res = await fetch(`${API_BASE}/api/v1/dao-admin/rewards-breakdown?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to load');
      const json = await res.json();
      const data = json.data;
      setRows(data?.records || data || []);
      if (data?.total != null) setTotal(data.total);
    } catch (err) {
      setError(err.message || 'Failed to load DAO rewards breakdown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBreakdown(appliedWallet, offset); }, [appliedWallet, offset, fetchBreakdown]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-indigo-900">DAO Rewards Breakdown</h2>
        <p className="text-sm text-indigo-600 mt-1">Per-wallet DAO trait-based pending rewards</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-indigo-100">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-indigo-700 mb-1">Wallet Address</label>
            <input type="text" value={walletFilter} placeholder="Filter by wallet address"
              onChange={e => setWalletFilter(e.target.value)}
              className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <button onClick={() => { setOffset(0); setAppliedWallet(walletFilter); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Search</button>
          <button onClick={() => { setWalletFilter(''); setOffset(0); setAppliedWallet(''); }}
            className="px-4 py-2 bg-white text-indigo-700 border border-indigo-300 rounded-md hover:bg-indigo-50">Clear</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-indigo-100">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-indigo-400">No DAO rewards data found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-indigo-100">
                  <thead className="bg-indigo-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Wallet Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase">Token</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase">Total Pending DAO Rewards</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-indigo-50">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{row.wallet_address}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-indigo-700">{row.token_symbol || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                          {Number(row.total_pending_dao_rewards).toLocaleString(undefined, { maximumFractionDigits: 6 })}
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

export default DaoRewardsBreakdown;
