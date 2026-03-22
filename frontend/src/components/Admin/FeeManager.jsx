// frontend/src/components/Admin/FeeManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidAmount } from '../../utils/validation';

const FeeManager = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Collection form state
  const [collectionForm, setCollectionForm] = useState({
    id: '',
    stake_fee: '0.001',
    unstake_fee: '0.001',
    claim_fee: '0.001' // Added claim fee to collection form
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);

      // Load collections
      const collectionsResponse = await api.admin.getCollections();
      setCollections(collectionsResponse.data.data);

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

  // Handle collection form input change
  const handleCollectionInputChange = (e) => {
    const { name, value } = e.target;

    setCollectionForm({
      ...collectionForm,
      [name]: value
    });
  };

  // Handle collection selection
  const handleCollectionSelect = (e) => {
    const collectionId = e.target.value;

    if (!collectionId) {
      setCollectionForm({
        id: '',
        stake_fee: '0.001',
        unstake_fee: '0.001',
        claim_fee: '0.001'
      });
      return;
    }

    const collection = collections.find(c => c.id === parseInt(collectionId));

    if (collection) {
      setCollectionForm({
        id: collection.id,
        stake_fee: collection.stake_fee || '0.001',
        unstake_fee: collection.unstake_fee || '0.001',
        claim_fee: collection.claim_fee || '0.001' // Get claim_fee from collection or default
      });
    }
  };

  // Handle collection fee form submit
  const handleCollectionFeeSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validate inputs
      if (!collectionForm.id) {
        setError('Please select a collection');
        return;
      }

      if (!isValidAmount(collectionForm.stake_fee) ||
          !isValidAmount(collectionForm.unstake_fee) ||
          !isValidAmount(collectionForm.claim_fee)) {
        setError('Invalid fee amount');
        return;
      }

      setLoading(true);
      setError(null);

      // Update collection
      await api.admin.updateCollection(collectionForm.id, {
        stake_fee: parseFloat(collectionForm.stake_fee),
        unstake_fee: parseFloat(collectionForm.unstake_fee),
        claim_fee: parseFloat(collectionForm.claim_fee) // Include claim_fee in the update
      });

      setSuccess('Collection fees updated successfully');

      // Reload data
      loadData();
    } catch (error) {
      console.error('Error updating collection fees:', error);
      setError(error.response?.data?.message || 'Failed to update collection fees');
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Fee Management</h2>
        <p className="text-gray-600 mt-1">Configure staking, unstaking, and claiming fees</p>
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

      {/* Collection Fees Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Collection-Specific Fees</h3>

        <form onSubmit={handleCollectionFeeSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collection
            </label>
            <select
              value={collectionForm.id}
              onChange={handleCollectionSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stake Fee (SOL)
              </label>
              <input
                type="number"
                name="stake_fee"
                value={collectionForm.stake_fee}
                onChange={handleCollectionInputChange}
                step="0.000000001"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unstake Fee (SOL)
              </label>
              <input
                type="number"
                name="unstake_fee"
                value={collectionForm.unstake_fee}
                onChange={handleCollectionInputChange}
                step="0.000000001"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Claim Fee (SOL)
              </label>
              <input
                type="number"
                name="claim_fee"
                value={collectionForm.claim_fee}
                onChange={handleCollectionInputChange}
                step="0.000000001"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                This fee will be charged when users claim their rewards
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !collectionForm.id}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
            >
              {loading ? 'Saving...' : 'Update Fees'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeeManager;