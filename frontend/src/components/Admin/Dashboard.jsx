// frontend/src/components/Admin/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatSol } from '../../utils/format';

const Dashboard = () => {
  const [stats, setStats] = useState({
    collections: 0,
    totalStaked: 0,
    stakeFeesCollected: 0,
    rewardsDistributed: 0,
    stakingActive: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load both dashboard stats and staking status
  const loadDashboardStats = async () => {
    console.log('🚀 loadDashboardStats called');

    try {
      setLoading(true);
      const response = await api.admin.getDashboardStats();

      // Also fetch the current staking status
      const settingsResponse = await api.admin.getSettings();
      const stakingActiveSetting = settingsResponse.data.data.find(
        setting => setting.key_name === 'staking_active'
      );

      const isStakingActive = stakingActiveSetting ?
        stakingActiveSetting.value.toLowerCase() === 'true' : false;

      console.log('✅ Dashboard API success:', response);
      console.log('✅ Staking active:', isStakingActive);

      if (response.data.success) {
        setStats({
          ...response.data.data,
          stakingActive: isStakingActive
        });
      }
    } catch (err) {
      console.error('❌ Dashboard API error:', err);
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const toggleStaking = async () => {
    try {
      setLoading(true);
      const newStakingStatus = !stats.stakingActive;

      const response = await api.admin.updateSettings([
        { key_name: 'staking_active', value: newStakingStatus.toString() }
      ]);

      if (response.data.success) {
        // Immediately update the local state to reflect the change
        setStats({
          ...stats,
          stakingActive: newStakingStatus
        });
        console.log(`✅ Staking ${newStakingStatus ? 'enabled' : 'disabled'} successfully`);
      }

      // Refresh all dashboard data
      loadDashboardStats();
    } catch (err) {
      console.error('Failed to toggle staking', err);
      setError('Failed to update staking status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <button
          onClick={toggleStaking}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white ${
            stats.stakingActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {stats.stakingActive ? 'Pause Staking' : 'Enable Staking'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Collections</h3>
          <div className="text-3xl font-bold text-gray-900">{stats.collections}</div>
          <Link to="/admin/collections" className="text-sm text-indigo-600 hover:text-indigo-900 mt-2 block">
            View collections →
          </Link>
        </div>

        {/* Only show if collections > 0 */}
        {stats.collections > 0 && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Staked NFTs</h3>
              <div className="text-3xl font-bold text-gray-900">{stats.totalStaked}</div>
              <div className="text-sm text-gray-500">Total NFTs currently staked</div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Fees Collected</h3>
              <div className="text-3xl font-bold text-gray-900">{formatSol(stats.stakeFeesCollected)} SOL</div>
              <div className="text-sm text-gray-500">Total fees from staking and unstaking</div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Rewards Distributed</h3>
              <div className="text-3xl font-bold text-gray-900">{stats.rewardsDistributed.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Tokens distributed to users</div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className={`mt-0.5 h-4 w-4 rounded-full ${stats.stakingActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Staking System</h4>
              <p className="text-sm text-gray-500">
                {stats.stakingActive
                  ? 'Staking is currently enabled.'
                  : 'Staking is currently paused.'}
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className={`mt-0.5 h-4 w-4 rounded-full ${stats.collections > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900">Collections</h4>
              <p className="text-sm text-gray-500">
                {stats.collections > 0
                  ? `${stats.collections} collections added`
                  : 'No collections yet. Please add one to enable staking.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;