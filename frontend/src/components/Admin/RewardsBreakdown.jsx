// frontend/src/components/Admin/RewardsBreakdown.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const fmt = (n) => {
  if (n === null || n === undefined) return '—';
  const num = parseFloat(n);
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const PeriodRow = ({ label, row, isTotal }) => (
  <tr className={isTotal ? 'bg-indigo-50 font-semibold' : 'hover:bg-gray-50'}>
    <td className="px-4 py-3 text-sm text-gray-900">{label}</td>
    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(row.daily)}</td>
    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(row.weekly)}</td>
    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmt(row.monthly)}</td>
    <td className="px-4 py-3 text-sm text-right text-indigo-700">{fmt(row.yearly)}</td>
  </tr>
);

const TokenTable = ({ title, rows, detailKey, detailCols }) => (
  <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
    </div>
    {rows.length === 0 ? (
      <div className="px-6 py-8 text-center text-gray-400">No data</div>
    ) : (
      rows.map(token => (
        <div key={token.token_symbol} className="border-b border-gray-100 last:border-0">
          {/* Token header */}
          <div className="px-6 py-3 bg-indigo-50 flex items-center gap-2">
            <span className="font-bold text-indigo-800 text-sm">{token.token_symbol}</span>
            <span className="text-xs text-gray-500 font-mono">{token.token_address?.slice(0,8)}...</span>
          </div>
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{detailCols[0]}</th>
                {detailCols.slice(1).map(c => <th key={c} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{c}</th>)}
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Week</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {token[detailKey].map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">{d.collection}</td>
                  {detailKey === 'traits' && <>
                    <td className="px-4 py-2 text-sm text-gray-600">{d.trait_type}: <span className="font-medium">{d.trait_value}</span></td>
                    <td className="px-4 py-2 text-sm text-gray-600">{d.matching} NFTs × {d.rate}/day</td>
                  </>}
                  {detailKey === 'collections' && <>
                    <td className="px-4 py-2 text-sm text-gray-600">{d.staked} NFTs × {d.rate}/day</td>
                  </>}
                  <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(d.daily)}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(d.daily * 7)}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(d.daily * 30)}</td>
                  <td className="px-4 py-2 text-sm text-right text-indigo-700">{fmt(d.daily * 365)}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-indigo-50 font-semibold">
                <td className="px-4 py-2 text-sm text-indigo-800" colSpan={detailKey === 'traits' ? 3 : 2}>TOTAL</td>
                <td className="px-4 py-2 text-sm text-right text-indigo-800">{fmt(token.daily)}</td>
                <td className="px-4 py-2 text-sm text-right text-indigo-800">{fmt(token.weekly)}</td>
                <td className="px-4 py-2 text-sm text-right text-indigo-800">{fmt(token.monthly)}</td>
                <td className="px-4 py-2 text-sm text-right text-indigo-800 font-bold">{fmt(token.yearly)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))
    )}
  </div>
);

const RewardsBreakdown = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.admin.getRewardsBreakdown()
      .then(r => { setData(r.data.data); setLoading(false); })
      .catch(e => { setError(e.response?.data?.message || 'Failed to load'); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" /></div>;
  if (error) return <div className="bg-red-100 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Rewards Breakdown</h2>
        <p className="text-gray-500 text-sm mt-1">Total token emissions needed based on currently staked NFTs</p>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-3">Base Rewards</h3>
      <TokenTable
        title="Base Collection Rewards — per token"
        rows={data.base}
        detailKey="collections"
        detailCols={['Collection', 'Rate']}
      />

      <h3 className="text-lg font-semibold text-gray-700 mb-3 mt-6">Trait-Based Rewards</h3>
      <TokenTable
        title="Trait Rewards — per token"
        rows={data.trait}
        detailKey="traits"
        detailCols={['Collection', 'Trait', 'Rate']}
      />
    </div>
  );
};

export default RewardsBreakdown;
