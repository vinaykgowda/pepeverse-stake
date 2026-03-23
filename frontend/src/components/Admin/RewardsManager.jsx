// frontend/src/components/Admin/RewardsManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidWalletAddress, isValidAmount } from '../../utils/validation';

const RewardsManager = () => {
  const [collections, setCollections] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    collection_id: '',
    token_address: '',
    token_symbol: '',
    token_decimals: '9',
    daily_rate: '1'
  });
  const [fetchingToken, setFetchingToken] = useState(false);
  const [tokenFetchError, setTokenFetchError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);

      // Load collections
      const collectionsResponse = await api.admin.getCollections();
      setCollections(collectionsResponse.data.data);

      // Load rewards
      const rewardsResponse = await api.admin.getRewards();
      setRewards(rewardsResponse.data.data);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenDetailsFromHelius = async (mint) => {
    try {
      // Use backend proxy instead of direct Helius API call
      // Requirement: 5.3 - Remove Helius API keys from frontend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/helius/nfts/metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mintAddress: mint
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch token details');
      }

      const metadata = data.data?.content?.metadata;
      const tokenInfo = data.data?.token_info;

      return {
        symbol: metadata?.symbol || '',
        decimals: tokenInfo?.decimals || '0'
      };
    } catch (error) {
      console.error("Failed to fetch token details:", error);
      return { symbol: '', decimals: '0' };
    }
  };


  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'token_address') setTokenFetchError(null);
  };

  // Fetch token details from Helius on button click
  const handleFetchToken = async () => {
    if (!isValidWalletAddress(formData.token_address)) {
      setTokenFetchError('Enter a valid token address first');
      return;
    }
    setFetchingToken(true);
    setTokenFetchError(null);
    const details = await fetchTokenDetailsFromHelius(formData.token_address);
    if (!details.symbol && details.decimals === '0') {
      setTokenFetchError('Could not fetch token details');
    } else {
      setFormData(prev => ({
        ...prev,
        token_symbol: details.symbol,
        token_decimals: details.decimals.toString()
      }));
    }
    setFetchingToken(false);
  };


  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate inputs
      if (!formData.collection_id) {
        setError('Please select a collection');
        return;
      }

      if (!isValidWalletAddress(formData.token_address)) {
        setError('Invalid token address');
        return;
      }

      if (!formData.token_symbol) {
        setError('Token symbol is required');
        return;
      }

      if (!isValidAmount(formData.daily_rate)) {
        setError('Invalid daily rate');
        return;
      }

      setLoading(true);
      setError(null);

      const rewardData = {
        collection_id: formData.collection_id,
        token_address: formData.token_address,
        token_symbol: formData.token_symbol,
        token_decimals: formData.token_decimals,
        daily_rate: parseFloat(formData.daily_rate)
      };

      if (editMode) {
        // Update reward
        await api.admin.updateReward(editId, rewardData);
        setSuccess('Reward updated successfully');
      } else {
        // Add new reward
        await api.admin.addReward(rewardData);
        setSuccess('Reward added successfully');
      }

      // Reset form
      setFormData({
        collection_id: '',
        token_address: '',
        token_symbol: '',
        token_decimals: '9',
        daily_rate: '1'
      });

      setShowForm(false);
      setEditMode(false);
      setEditId(null);

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error saving reward:', error);
      setError(error.response?.data?.message || 'Failed to save reward');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button
  const handleEdit = (reward) => {
    setFormData({
      collection_id: reward.collection_id,
      token_address: reward.token_address,
      token_symbol: reward.token_symbol,
      token_decimals: reward.token_decimals,
      daily_rate: reward.daily_rate
    });

    setEditMode(true);
    setEditId(reward.id);
    setShowForm(true);
  };

  // Handle delete button
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) {
      return;
    }

    try {
      setLoading(true);

      await api.admin.deleteReward(id);
      setSuccess('Reward deleted successfully');

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error deleting reward:', error);
      setError(error.response?.data?.message || 'Failed to delete reward');
    } finally {
      setLoading(false);
    }
  };

  // Toggle reward active status
  const toggleActive = async (id, isActive) => {
    try {
      setLoading(true);

      await api.admin.updateReward(id, { is_active: !isActive });

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error updating reward:', error);
      setError(error.response?.data?.message || 'Failed to update reward');
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
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Rewards</h2>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditMode(false);
            setEditId(null);
            setFormData({
              collection_id: '',
              token_address: '',
              token_symbol: '',
              token_decimals: '9',
              daily_rate: '1'
            });
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {showForm ? 'Cancel' : 'Add Reward'}
        </button>
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

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editMode ? 'Edit Reward' : 'Add New Reward'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection
                </label>
                <select
                  name="collection_id"
                  value={formData.collection_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a collection</option>
                  {collections?.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="token_address"
                    value={formData.token_address}
                    onChange={handleInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter token mint address"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleFetchToken}
                    disabled={fetchingToken}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
                  >
                    {fetchingToken ? '...' : 'Fetch'}
                  </button>
                </div>
                {tokenFetchError && (
                  <p className="mt-1 text-xs text-red-500">{tokenFetchError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    name="token_symbol"
                    value={formData.token_symbol}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token Decimals
                  </label>
                  <input
                    type="number"
                    name="token_decimals"
                    value={formData.token_decimals}
                    onChange={handleInputChange}
                    min="0"
                    max="18"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Rate
                </label>
                <input
                  type="number"
                  name="daily_rate"
                  value={formData.daily_rate}
                  onChange={handleInputChange}
                  step="0.000000001"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Amount of tokens earned per NFT per day
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {loading ? 'Saving...' : editMode ? 'Update Reward' : 'Add Reward'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {rewards.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No rewards found. Add your first reward using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{reward.collection_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{reward.token_symbol}</div>
                      <div className="text-xs text-gray-500">{reward.token_address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{reward.daily_rate} / day</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          reward.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {reward.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleActive(reward.id, reward.is_active)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        {reward.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEdit(reward)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(reward.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default RewardsManager;