// frontend/src/components/Admin/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [stakingActive, setStakingActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [dashRes, settingsRes] = await Promise.all([
        api.admin.getDashboardStats(),
        api.admin.getSettings(),
      ]);
      if (dashRes.data.success) setData(dashRes.data.data);
      const s = settingsRes.data.data?.find(x => x.key_name === 'staking_active');
      setStakingActive(s ? s.value?.toLowerCase() === 'true' : false);
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStaking = async () => {
    try {
      setLoading(true);
      const next = !stakingActive;
      await api.admin.updateSettings([{ key_name: 'staking_active', value: next.toString() }]);
      setStakingActive(next);
    } catch {
      setError('Failed to update staking status');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

  const timeLeft = (expiresAt) => {
    const ms = new Date(expiresAt) - Date.now();
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    return d > 0 ? `${d}d ${h % 24}h left` : `${h}h left`;
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <button
          onClick={toggleStaking}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white font-medium ${stakingActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}
        >
          {stakingActive ? 'Pause Staking' : 'Enable Staking'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : data ? (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-5">
              <div className="text-sm text-gray-500 mb-1">Collections</div>
              <div className="text-3xl font-bold text-gray-900">{data.total_collections}</div>
              <Link to="/admin/collections" className="text-xs text-indigo-600 hover:underline mt-1 block">Manage →</Link>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="text-sm text-gray-500 mb-1">Total Staked NFTs</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(data.total_staked_nfts)}</div>
              <div className="text-xs text-gray-400 mt-1">{fmt(data.total_staking_wallets)} unique wallets</div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="text-sm text-gray-500 mb-1">Rewards Distributed</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(data.total_rewards_distributed)}</div>
              <div className="text-xs text-gray-400 mt-1">tokens claimed total</div>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <div className="text-sm text-gray-500 mb-1">Active Airdrops</div>
              <div className="text-3xl font-bold text-gray-900">{data.active_airdrops?.length ?? 0}</div>
              <Link to="/admin/airdrops" className="text-xs text-indigo-600 hover:underline mt-1 block">View airdrops →</Link>
            </div>
          </div>

          {/* Collections breakdown */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-800">Collections</h3>
              <Link to="/admin/collections" className="text-sm text-indigo-600 hover:underline">Manage</Link>
            </div>
            {data.collections?.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No collections yet. <Link to="/admin/collections" className="text-indigo-600 hover:underline">Add one →</Link>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collection</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Staked NFTs</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unique Stakers</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stake Fee</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Claim Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.collections.map(c => (
                    <tr key={c.id}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(c.staked_count)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(c.unique_stakers)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-500">{c.stake_fee} SOL</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-500">{c.claim_fee} SOL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Daily rewards needed */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-800">Daily Rewards Needed</h3>
              <Link to="/admin/rewards" className="text-sm text-indigo-600 hover:underline">Manage rewards</Link>
            </div>
            {!data.daily_rewards?.length ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No active rewards configured. <Link to="/admin/rewards" className="text-indigo-600 hover:underline">Add rewards →</Link>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Staked NFTs</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tokens / Day</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tokens / Week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.daily_rewards.map(r => (
                    <tr key={r.token_address}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.token_symbol}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(r.staked_count)}</td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-indigo-700">{fmt(r.daily_total)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-500">{fmt(r.daily_total * 7)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Active airdrops */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-base font-semibold text-gray-800">Live Airdrops</h3>
              <Link to="/admin/airdrops" className="text-sm text-indigo-600 hover:underline">Manage airdrops</Link>
            </div>
            {!data.active_airdrops?.length ? (
              <div className="px-6 py-8 text-center text-gray-400">
                No active airdrops. <Link to="/admin/airdrops" className="text-indigo-600 hover:underline">Create one →</Link>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collection</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eligible</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Claimed</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Tokens</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.active_airdrops.map(a => (
                    <tr key={a.id}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{a.collection_name}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">{a.token_symbol}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(a.total_eligible)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-700">
                        {fmt(a.claimed_count)}
                        <span className="text-xs text-gray-400 ml-1">
                          ({a.total_eligible > 0 ? Math.round(a.claimed_count / a.total_eligible * 100) : 0}%)
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-indigo-700">{fmt(a.total_tokens)} {a.token_symbol}</td>
                      <td className="px-6 py-3 text-sm text-right">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">{timeLeft(a.expires_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* System status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">System Status</h3>
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${stakingActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-700">
                Staking is currently <strong>{stakingActive ? 'enabled' : 'paused'}</strong>
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Dashboard;
