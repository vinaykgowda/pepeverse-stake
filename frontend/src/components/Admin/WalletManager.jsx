// frontend/src/components/Admin/WalletManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidWalletAddress } from '../../utils/validation';
import { formatWalletAddress } from '../../utils/format';

const WalletManager = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  // Load settings on mount
  useEffect(() => {
    loadSettings();
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

      // Reload settings
      loadSettings();
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
    </div>
  );
};

export default WalletManager;