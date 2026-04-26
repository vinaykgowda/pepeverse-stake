// frontend/src/pages/DaoAdmin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import DaoAdminLayout from '../../components/Layout/DaoAdminLayout';

// Strip trailing /api/v1 from VITE_API_URL if present — paths below include /api/v1 already
const _base = import.meta.env.VITE_API_URL || '';
const API_BASE = _base.endsWith('/api/v1') ? _base.slice(0, -7) : _base;

const StatCard = ({ label, value, icon, loading }) => (
  <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500 flex items-center gap-4">
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-sm font-medium text-indigo-600">{label}</p>
      {loading ? (
        <div className="h-8 w-24 bg-indigo-100 animate-pulse rounded mt-1"></div>
      ) : (
        <p className="text-2xl font-bold text-indigo-900">{value}</p>
      )}
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/dao-admin/analytics/dashboard`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Failed to load dashboard');
        const json = await res.json();
        setStats(json.data || json);
      } catch (err) {
        setError(err.message || 'Failed to load DAO dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const fmt = (val) => val != null ? Number(val).toLocaleString() : '—';

  return (
    <DaoAdminLayout>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-900">DAO Dashboard</h1>
          <p className="text-indigo-600 mt-1">Overview of DAO staking activity</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Eligible NFTs Staked"
            value={fmt(stats?.total_dao_stakers)}
            icon="🏛️"
            loading={loading}
          />
          <StatCard
            label="Total DAO Rewards Distributed"
            value={fmt(stats?.total_dao_rewards_distributed)}
            icon="💎"
            loading={loading}
          />
          <StatCard
            label="Active DAO Admins"
            value={fmt(stats?.active_dao_admins)}
            icon="👥"
            loading={loading}
          />
        </div>
      </div>
    </DaoAdminLayout>
  );
};

export default Dashboard;
