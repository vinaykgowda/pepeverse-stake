// frontend/src/components/Admin/WalletManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidWalletAddress } from '../../utils/validation';
import { formatWalletAddress } from '../../utils/format';

const truncateMintAddress = (address) => {
  if (!address || address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const WalletManager = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Token balances state
  const [tokenBalances, setTokenBalances] = useState([]);
  const [tokenBalancesLoading, setTokenBalancesLoading] = useState(false);
  const [tokenBalancesError, setTokenBalancesError] = useState(null);
  const [walletNotConfigured, setWalletNotConfigured] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    rewards_wallet: '',
    private_key: ''
  });

  // Load settings
  const loadSettings = async () => {
    try {
      setLoading(true);

      const response = await api.admin.getSettings();
      setSettings(response.data.data);

      // Set wallet address from settings
      const walletSetting = response.data.data.find(s => s.key_name === 'rewards_wallet');

      if (walletSetting) {
        setFormData({
          ...formData,
          rewards_wallet: walletSetting.value
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Fetch token balances
  const fetchTokenBalances = async () => {
    try {
      setTokenBalancesLoading(true);
      setTokenBalancesError(null);
      setWalletNotConfigured(false);

      const response = await api.admin.getTokenBalances();
      const data = response.data;

      if (data.walletNotConfigured) {
        setWalletNotConfigured(true);
        setTokenBalances([]);
      } else {
        setTokenBalances(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching token balances:', err);
      setTokenBalancesError('Failed to fetch token balances');
    } finally {
      setTokenBalancesLoading(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    fetchTokenBalances();
  }, []);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate inputs
      if (!isValidWalletAddress(formData.rewards_wallet)) {
        setError('Invalid wallet address');
        return;
      }

      // If private key is provided, validate it (simplified validation)
      if (formData.private_key && formData.private_key.length < 32) {
        setError('Invalid private key');
        return;
      }

      setLoading(true);
      setError(null);

      // Update settings
      const settingsToUpdate = [
        {
          key_name: 'rewards_wallet',
          value: formData.rewards_wallet
        }
      ];

      // Add private key if provided
      if (formData.private_key) {
        settingsToUpdate.push({
          key_name: 'rewards_wallet_encrypted_key',
          value: formData.private_key // Note: In production, this would be encrypted properly server-side
        });
      }

      await api.admin.updateSettings(settingsToUpdate);

      setSuccess('Rewards wallet updated successfully');

      // Reset private key field
      setFormData({
        ...formData,
        private_key: ''
      });

      // Reload settings and refresh token balances
      loadSettings();
      fetchTokenBalances();
    } catch (error) {
      console.error('Error updating wallet:', error);
      setError(error.response?.data?.message || 'Failed to update wallet');
    } finally {
      setLoading(false);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Check if wallet is set up
  const isWalletSetup = () => {
    const walletSetting = settings.find(s => s.key_name === 'rewards_wallet');
    const keySetting = settings.find(s => s.key_name === 'rewards_wallet_encrypted_key');

    return walletSetting?.value && keySetting?.value;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Rewards Wallet Setup</h2>
        <p className="text-gray-600 mt-1">Configure the wallet used for distributing rewards and collecting fees</p>
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
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Current Status</h3>

          <div className="flex items-center">
            <div className={`h-4 w-4 rounded-full mr-2 ${isWalletSetup() ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isWalletSetup() ? 'Wallet is set up and ready' : 'Wallet needs to be configured'}
            </span>
          </div>

          {isWalletSetup() && (
            <div className="mt-2 text-sm text-gray-500">
              Current wallet: {formatWalletAddress(formData.rewards_wallet)}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rewards Wallet Address
              </label>
              <input
                type="text"
                name="rewards_wallet"
                value={formData.rewards_wallet}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                This wallet will be used to distribute rewards and collect fees
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Key
              </label>
              <input
                type="password"
                name="private_key"
                value={formData.private_key}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {isWalletSetup()
                  ? 'Leave blank to keep the current private key'
                  : 'The private key will be securely encrypted and used for automated transactions'}
              </p>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important Security Notice:</strong> The private key is used to automate reward distributions.
                    Ensure this wallet only contains funds needed for operations and is not your main wallet.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
              >
                {loading ? 'Saving...' : 'Save Wallet Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Token Balance Table */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Token Balances</h3>
          <button
            onClick={fetchTokenBalances}
            disabled={tokenBalancesLoading}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
          >
            {tokenBalancesLoading ? 'Refreshing...' : 'Refresh Balances'}
          </button>
        </div>

        {tokenBalancesError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {tokenBalancesError}
          </div>
        )}

        {walletNotConfigured ? (
          <div className="text-center py-8 text-gray-500">
            <p>Rewards wallet not configured. Set up a wallet above to view token balances.</p>
          </div>
        ) : tokenBalancesLoading && tokenBalances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Loading token balances...</p>
          </div>
        ) : tokenBalances.length === 0 && !tokenBalancesLoading ? (
          <div className="text-center py-8 text-gray-500">
            <p>No reward tokens configured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mint Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokenBalances.map((row, index) => (
                  <tr key={row.token_address || index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      <span title={row.token_address}>
                        {truncateMintAddress(row.token_address)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.error ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Error
                        </span>
                      ) : (
                        row.balance
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletManager;