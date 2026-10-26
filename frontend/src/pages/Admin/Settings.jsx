// frontend/src/pages/Admin/Settings.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import AdminLayout from '../../components/Layout/AdminLayout';

const Settings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const DEFAULT_MAINTENANCE_MESSAGE =
    'Staking reward claims are temporarily disabled for maintenance. Your NFTs keep earning and your balance is safe — you can claim once maintenance is complete.';

  const [formData, setFormData] = useState({
    staking_active: true,
    minimum_claim_amount: '1',
    // claims_enabled is the friendly inverse of the stored `claims_disabled` flag
    claims_enabled: true,
    claims_maintenance_message: DEFAULT_MAINTENANCE_MESSAGE
  });

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);

      const response = await api.admin.getSettings();
      setSettings(response.data.data);

      // Set form data from settings
      const stakingActiveSetting = response.data.data.find(s => s.key_name === 'staking_active');
      const minClaimSetting = response.data.data.find(s => s.key_name === 'minimum_claim_amount');
      const claimsDisabledSetting = response.data.data.find(s => s.key_name === 'claims_disabled');
      const maintenanceMsgSetting = response.data.data.find(s => s.key_name === 'claims_maintenance_message');

      setFormData({
        staking_active: stakingActiveSetting?.value === 'true',
        minimum_claim_amount: minClaimSetting?.value || '1',
        // claims are enabled unless the stored flag is explicitly 'true'
        claims_enabled: claimsDisabledSetting?.value !== 'true',
        claims_maintenance_message: maintenanceMsgSetting?.value || DEFAULT_MAINTENANCE_MESSAGE
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Update settings
      await api.admin.updateSettings([
        {
          key_name: 'staking_active',
          value: formData.staking_active.toString()
        },
        {
          key_name: 'minimum_claim_amount',
          value: formData.minimum_claim_amount
        },
        {
          // stored flag is the inverse of the friendly "Enable Claims" toggle
          key_name: 'claims_disabled',
          value: (!formData.claims_enabled).toString()
        },
        {
          key_name: 'claims_maintenance_message',
          value: formData.claims_maintenance_message
        }
      ]);

      setSuccess('Settings updated successfully');

      // Reload settings
      loadSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
      setError(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Platform Settings</h2>
        <p className="text-gray-600 mt-1">Configure global platform settings</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={clearMessages}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="sr-only">Close</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative">
          <span className="block sm:inline">{success}</span>
          <button
            onClick={clearMessages}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="sr-only">Close</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="staking_active"
                  name="staking_active"
                  checked={formData.staking_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="staking_active" className="ml-2 block text-sm text-gray-900">
                  Enable Staking
                </label>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                When disabled, users will not be able to stake new NFTs, but they can still unstake and claim rewards.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="minimum_claim_amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Claim Amount
                  </label>
                  <input
                    type="number"
                    id="minimum_claim_amount"
                    name="minimum_claim_amount"
                    value={formData.minimum_claim_amount}
                    onChange={handleInputChange}
                    step="0.0001"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Minimum amount of rewards required to claim
                  </p>
                </div>
              </div>
            </div>

            {/* Claims (maintenance) settings — applies to BOTH main staking and DAO staking */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reward Claims</h3>

              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="claims_enabled"
                  name="claims_enabled"
                  checked={formData.claims_enabled}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="claims_enabled" className="ml-2 block text-sm text-gray-900">
                  Enable Reward Claims (Staking &amp; DAO Staking)
                </label>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                When disabled, users cannot claim staking or DAO staking rewards. NFTs keep
                earning and current earnings stay visible — only claiming is paused. A
                maintenance banner is shown and the Claim buttons are disabled.
              </p>

              {!formData.claims_enabled && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 rounded mb-4 text-sm">
                  ⚠️ Reward claims are currently <strong>disabled</strong>. Users will see the maintenance message below.
                </div>
              )}

              <div>
                <label htmlFor="claims_maintenance_message" className="block text-sm font-medium text-gray-700 mb-1">
                  Maintenance Message
                </label>
                <textarea
                  id="claims_maintenance_message"
                  name="claims_maintenance_message"
                  value={formData.claims_maintenance_message}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Shown to users while claims are disabled.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">All Settings</h3>

        {loading && settings.length === 0 ? (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Setting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settings.map((setting) => (
                  <tr key={setting.key_name}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{setting.key_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {setting.key_name === 'rewards_wallet_encrypted_key'
                          ? '[ENCRYPTED]'
                          : setting.value}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{setting.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(setting.updated_at).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Settings;