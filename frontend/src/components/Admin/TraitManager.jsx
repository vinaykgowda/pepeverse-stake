// frontend/src/components/Admin/TraitManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { isValidWalletAddress, isValidTraitValue } from '../../utils/validation';

const TraitManager = () => {
  const [collections, setCollections] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [traitRewards, setTraitRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    collection_id: '',
    trait_type: '',
    trait_value: '',
    token_address: '',
    token_symbol: '',
    earn_amount: '5',
    // new token fields
    new_token_address: '',
    new_token_symbol: '',
  });
  const [tokenMode, setTokenMode] = useState('existing'); // 'existing' | 'new'
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [collectionTokens, setCollectionTokens] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [colRes, rewRes, traitRes] = await Promise.all([
        api.admin.getCollections(),
        api.admin.getRewards(),
        api.admin.getTraitRewards(),
      ]);
      setCollections(colRes.data.data);
      setRewards(rewRes.data.data);
      setTraitRewards(traitRes.data.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (formData.collection_id) {
      const id = parseInt(formData.collection_id);
      const tokens = rewards.filter(r => r.collection_id === id);
      setCollectionTokens(tokens);
      if (tokens.length > 0 && !tokens.find(t => t.token_address === formData.token_address)) {
        setFormData(prev => ({
          ...prev,
          token_address: tokens[0].token_address,
          token_symbol: tokens[0].token_symbol,
        }));
      }
    } else {
      setCollectionTokens([]);
    }
  }, [formData.collection_id, rewards]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'token_address') {
        const token = collectionTokens.find(t => t.token_address === value);
        if (token) next.token_symbol = token.token_symbol;
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormData({
      collection_id: '', trait_type: '', trait_value: '',
      token_address: '', token_symbol: '', earn_amount: '5',
      new_token_address: '', new_token_symbol: '',
    });
    setTokenMode('existing');
    setEditMode(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.collection_id) return setError('Please select a collection');
    if (!isValidTraitValue(formData.trait_type) || !isValidTraitValue(formData.trait_value))
      return setError('Trait type and value are required');

    const earnAmount = parseFloat(formData.earn_amount);
    if (isNaN(earnAmount) || earnAmount <= 0) return setError('Earn amount must be a positive number');

    let tokenAddress, tokenSymbol;
    if (tokenMode === 'new') {
      if (!isValidWalletAddress(formData.new_token_address)) return setError('Invalid new token address');
      if (!formData.new_token_symbol.trim()) return setError('New token symbol is required');
      tokenAddress = formData.new_token_address;
      tokenSymbol = formData.new_token_symbol.trim().toUpperCase();
    } else {
      if (!formData.token_address) return setError('Please select a token');
      tokenAddress = formData.token_address;
      tokenSymbol = formData.token_symbol;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        collection_id: formData.collection_id,
        trait_type: formData.trait_type,
        trait_value: formData.trait_value,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        multiplier: earnAmount, // stored in multiplier column, now means flat earn amount
      };

      if (editMode) {
        await api.admin.updateTraitReward(editId, payload);
        setSuccess('Trait reward updated successfully');
      } else {
        await api.admin.addTraitReward(payload);
        setSuccess('Trait reward added successfully');
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save trait reward');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tr) => {
    setFormData({
      collection_id: tr.collection_id,
      trait_type: tr.trait_type,
      trait_value: tr.trait_value,
      token_address: tr.token_address,
      token_symbol: tr.token_symbol,
      earn_amount: tr.multiplier,
      new_token_address: '',
      new_token_symbol: '',
    });
    setTokenMode('existing');
    setEditMode(true);
    setEditId(tr.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trait reward?')) return;
    try {
      setLoading(true);
      await api.admin.deleteTraitReward(id);
      setSuccess('Trait reward deleted');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      setLoading(true);
      await api.admin.updateTraitReward(id, { is_active: !isActive });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Trait-Based Rewards</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {showForm ? 'Cancel' : 'Add Trait Reward'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
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

              {/* Collection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                <select
                  name="collection_id"
                  value={formData.collection_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select a collection</option>
                  {collections?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Trait Type + Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trait Type</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trait Value</label>
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

              {/* Token — existing or new */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setTokenMode('existing')}
                    className={`px-3 py-1 text-sm rounded-md border ${tokenMode === 'existing' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Select existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTokenMode('new')}
                    className={`px-3 py-1 text-sm rounded-md border ${tokenMode === 'new' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Add new token
                  </button>
                </div>

                {tokenMode === 'existing' ? (
                  <>
                    <select
                      name="token_address"
                      value={formData.token_address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={collectionTokens.length === 0}
                    >
                      {collectionTokens.length === 0
                        ? <option value="">No tokens — select a collection or add a new token</option>
                        : <>
                            <option value="">Select a token</option>
                            {collectionTokens.map(t => (
                              <option key={t.id} value={t.token_address}>{t.token_symbol}</option>
                            ))}
                          </>
                      }
                    </select>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        name="new_token_address"
                        value={formData.new_token_address}
                        onChange={handleInputChange}
                        placeholder="Token mint address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="new_token_symbol"
                        value={formData.new_token_symbol}
                        onChange={handleInputChange}
                        placeholder="Symbol (e.g. EMPIRE)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Earn Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Earn Amount (per day)
                </label>
                <input
                  type="number"
                  name="earn_amount"
                  value={formData.earn_amount}
                  onChange={handleInputChange}
                  step="1"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  NFTs with this trait earn this many tokens per day
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trait</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earns / day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {traitRewards.map(tr => (
                  <tr key={tr.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tr.collection_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tr.trait_type}</div>
                      <div className="text-xs text-gray-500">{tr.trait_value}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tr.token_symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(tr.multiplier)} ${tr.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tr.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {tr.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => toggleActive(tr.id, tr.is_active)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                        {tr.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleEdit(tr)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                      <button onClick={() => handleDelete(tr.id)} className="text-red-600 hover:text-red-900">Delete</button>
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
