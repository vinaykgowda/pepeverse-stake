// frontend/src/components/DaoAdmin/DaoRewardsBreakdown.jsx
// Mirrors the regular Rewards Breakdown — shows per-token DAO emission rates by collection+trait
import React, { useState, useEffect, useCallback } from 'react';

const _base = import.meta.env.VITE_API_URL || '';
const API_BASE = _base.endsWith('/api/v1') ? _base.slice(0, -7) : _base;

const fmt = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const DaoRewardsBreakdown = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBreakdown = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dao-admin/rewards-breakdown`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to load');
      const json = await res.json();
      setTokens(json.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load DAO rewards breakdown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-indigo-900">DAO Rewards Breakdown</h2>
        <p className="text-sm text-indigo-600 mt-1">Total DAO token emissions based on currently staked NFTs with matching traits</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : tokens.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center text-indigo-400 border border-indigo-100">
          No active DAO trait rewards found. Add DAO trait rewards to see emission projections.
        </div>
      ) : (
        <div className="space-y-8">
          {tokens.map(token => (
            <div key={token.token_address} className="bg-white rounded-xl shadow-md border border-indigo-100 overflow-hidden">
              {/* Token header */}
              <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-3">
                <span className="text-lg font-bold text-indigo-800">{token.token_symbol}</span>
                <span className="text-xs font-mono text-indigo-400">{token.token_address.slice(0, 8)}…</span>
              </div>

              {/* Collection+trait rows */}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-indigo-50/50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase tracking-wider">Collection</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase tracking-wider">Trait</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 uppercase tracking-wider">Rate</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider">Day</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider">Week</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider">Month</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {token.collections.map((col, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{col.collection_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span className="font-medium">{col.trait_type}</span>
                          <span className="text-gray-400 mx-1">:</span>
                          <span>{col.trait_value}</span>
                          <span className="ml-2 text-xs text-indigo-400">({col.matching_nft_count} NFTs × {col.multiplier}/day)</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-indigo-600">
                          {col.matching_nft_count} NFTs × {col.multiplier}/day
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">{fmt(col.daily)}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-700">{fmt(col.weekly)}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-700">{fmt(col.monthly)}</td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-indigo-700">{fmt(col.yearly)}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                      <td className="px-6 py-3 text-sm text-indigo-800" colSpan={3}>TOTAL {token.token_symbol}</td>
                      <td className="px-6 py-3 text-sm text-right text-indigo-800">{fmt(token.total_daily)}</td>
                      <td className="px-6 py-3 text-sm text-right text-indigo-800">{fmt(token.total_weekly)}</td>
                      <td className="px-6 py-3 text-sm text-right text-indigo-800">{fmt(token.total_monthly)}</td>
                      <td className="px-6 py-3 text-sm text-right text-indigo-800">{fmt(token.total_yearly)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DaoRewardsBreakdown;
