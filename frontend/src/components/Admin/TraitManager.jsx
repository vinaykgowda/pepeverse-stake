// frontend/src/components/Admin/TraitManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidWalletAddress, isValidMultiplier, isValidTraitValue } from '../../utils/validation';

const TraitManager = () => {
  const [collections, setCollections] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [traitRewards, setTraitRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    collection_id: '',
    trait_type: '',
    trait_value: '',
    token_address: '',
    token_symbol: '',
    multiplier: '1.5'
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  // Collection tokens
  const [collectionTokens, setCollectionTokens] = useState([]);

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

      // Load trait rewards
      const traitRewardsResponse = await api.admin.getTraitRewards();
      setTraitRewards(traitRewardsResponse.data.data);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Update collection tokens when collection changes
  useEffect(() => {
    if (formData.collection_id) {
      const collectionId = parseInt(formData.collection_id);
      const filteredTokens = rewards.filter(reward => reward.collection_id === collectionId);
      setCollectionTokens(filteredTokens);

      // Reset token if not in collection tokens
      if (filteredTokens.length > 0 && !filteredTokens.find(token => token.token_address === formData.token_address)) {
        setFormData({
          ...formData,
          token_address: filteredTokens[0].token_address,
          token_symbol: filteredTokens[0].token_symbol
        });
      }
    } else {
      setCollectionTokens([]);
    }
  }, [formData.collection_id, rewards]);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value
    });

    // Update token symbol when token address changes
    if (name === 'token_address') {
      const token = collectionTokens.find(token => token.token_address === value);

      if (token) {
        setFormData({
          ...formData,
          token_address: value,
          token_symbol: token.token_symbol
        });
      }
    }
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

      if (!isValidTraitValue(formData.trait_type) || !isValidTraitValue(formData.trait_value)) {
        setError('Trait type and value are required');
        return;
      }

      if (!isValidWalletAddress(formData.token_address)) {
        setError('Invalid token address');
        return;
      }

      if (!isValidMultiplier(formData.multiplier)) {
        setError('Invalid multiplier value');
        return;
      }

      setLoading(true);
      setError(null);

      const traitRewardData = {
        collection_id: formData.collection_id,
        trait_type: formData.trait_type,
        trait_value: formData.trait_value,
        token_address: formData.token_address,
        token_symbol: formData.token_symbol,
        multiplier: parseFloat(formData.multiplier)
      };

      if (editMode) {
        // Update trait reward
        await api.admin.updateTraitReward(editId, traitRewardData);
        setSuccess('Trait reward updated successfully');
      } else {
        // Add new trait reward
        await api.admin.addTraitReward(traitRewardData);
        setSuccess('Trait reward added successfully');
      }

      // Reset form
      setFormData({
        collection_id: '',
        trait_type: '',
        trait_value: '',
        token_address: '',
        token_symbol: '',
        multiplier: '1.5'
      });

      setShowForm(false);
      setEditMode(false);
      setEditId(null);

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error saving trait reward:', error);
      setError(error.response?.data?.message || 'Failed to save trait reward');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button
  const handleEdit = (traitReward) => {
    setFormData({
      collection_id: traitReward.collection_id,
      trait_type: traitReward.trait_type,
      trait_value: traitReward.trait_value,
      token_address: traitReward.token_address,
      token_symbol: traitReward.token_symbol,
      multiplier: traitReward.multiplier
    });

    setEditMode(true);
    setEditId(traitReward.id);
    setShowForm(true);
  };

  // Handle delete button
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this trait reward?')) {
      return;
    }

    try {
      setLoading(true);

      await api.admin.deleteTraitReward(id);
      setSuccess('Trait reward deleted successfully');

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error deleting trait reward:', error);
      setError(error.response?.data?.message || 'Failed to delete trait reward');
    } finally {
      setLoading(false);
    }
  };

  // Toggle trait reward active status
  const toggleActive = async (id, isActive) => {
    try {
      setLoading(true);

      await api.admin.updateTraitReward(id, { is_active: !isActive });

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error updating trait reward:', error);
      setError(error.response?.data?.message || 'Failed to update trait reward');
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
        <h2 className="text-2xl font-bold text-gray-800">Trait-Based Rewards</h2>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditMode(false);
            setEditId(null);
            setFormData({
              collection_id: '',
              trait_type: '',
              trait_value: '',
              token_address: '',
              token_symbol: '',
              multiplier: '1.5'
            });
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {showForm ? 'Cancel' : 'Add Trait Reward'}
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
            {editMode ? 'Edit Trait Reward' : 'Add New Trait Reward'}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trait Type
                  </label>
                  <input
                    type="text"
                    name="trait_type"
                    value={formData.trait_type}
                    onChange={handleInputChange}
                    placeholder="e.g. Background, Eyes, Mouth"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trait Value
                  </label>
                  <input
                    type="text"
                    name="trait_value"
                    value={formData.trait_value}
                    onChange={handleInputChange}
                    placeholder="e.g. Blue, Rare, Gold"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token
                </label>
                <select
                  name="token_address"
                  value={formData.token_address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  disabled={collectionTokens.length === 0}
                >
                  {collectionTokens.length === 0 ? (
                    <option value="">No tokens for selected collection</option>
                  ) : (
                    <>
                      <option value="">Select a token</option>
                      {collectionTokens.map((token) => (
                        <option key={token.id} value={token.token_address}>
                          {token.token_symbol}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {collectionTokens.length === 0 && formData.collection_id && (
                  <p className="mt-1 text-sm text-red-500">
                    Please add a reward token for this collection first
                  </p>
                )}
              </div>

              <div>
<label className="block text-sm font-medium text-gray-700 mb-1">
                  Multiplier
                </label>
                <input
                  type="number"
                  name="multiplier"
                  value={formData.multiplier}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Base reward will be multiplied by this value for NFTs with this trait
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || collectionTokens.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {loading ? 'Saving...' : editMode ? 'Update Trait Reward' : 'Add Trait Reward'}
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
          {traitRewards.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No trait rewards found. Add your first trait reward using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trait
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Multiplier
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
                {traitRewards.map((traitReward) => (
                  <tr key={traitReward.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{traitReward.collection_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{traitReward.trait_type}</div>
                      <div className="text-xs text-gray-500">{traitReward.trait_value}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{traitReward.token_symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">x{traitReward.multiplier}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          traitReward.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {traitReward.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleActive(traitReward.id, traitReward.is_active)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        {traitReward.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEdit(traitReward)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(traitReward.id)}
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

export default TraitManager;