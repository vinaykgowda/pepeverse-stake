// frontend/src/components/DaoAdmin/DaoTraitManager.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
});

const BASE = '/api/v1/dao-admin';

const DaoTraitManager = () => {
  const [collections, setCollections] = useState([]);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [traitRewards, setTraitRewards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  const [formData, setFormData] = useState({
    collection_id: '',
    trait_type: '',
    trait_value: '',
    token_address: '',
    token_symbol: '',
    token_decimals: 9,
    multiplier: '5',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [colRes, tokRes, traitRes] = await Promise.all([
        axios.get(`${BASE}/collections`, authHeaders()),
        axios.get(`${BASE}/available-tokens`, authHeaders()),
        axios.get(`${BASE}/trait-rewards`, authHeaders()),
      ]);
      setCollections(colRes.data.data || []);
      setAvailableTokens(tokRes.data.data || []);
      setTraitRewards(traitRes.data.data || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'token_address') {
        const token = availableTokens.find(t => t.token_address === value);
        if (token) {
          next.token_symbol = token.token_symbol;
          next.token_decimals = token.token_decimals ?? 9;
        }
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormData({
      collection_id: '',
      trait_type: '',
      trait_value: '',
      token_address: '',
      token_symbol: '',
      token_decimals: 9,
      multiplier: '5',
    });
    setEditMode(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.collection_id) return setError('Please select a collection');
    if (!formData.trait_type.trim() || !formData.trait_value.trim())
      return setError('Trait type and value are required');
    if (!formData.token_address) return setError('Please select a token');
    const multiplier = parseFloat(formData.multiplier);
    if (isNaN(multiplier) || multiplier <= 0) return setError('Multiplier must be a positive number');

    setLoading(true);
    setError(null);
    try {
      const payload = {
        collection_id: formData.collection_id,
        trait_type: formData.trait_type.trim(),
        trait_value: formData.trait_value.trim(),
        token_address: formData.token_address,
        token_symbol: formData.token_symbol,
        token_decimals: formData.token_decimals,
        multiplier,
      };

      if (editMode) {
        await axios.put(`${BASE}/trait-rewards/${editId}`, payload, authHeaders());
        setSuccess('DAO trait reward updated successfully');
      } else {
        await axios.post(`${BASE}/trait-rewards`, payload, authHeaders());
        setSuccess('DAO trait reward added successfully');
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save DAO trait reward');
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
      token_decimals: tr.token_decimals ?? 9,
      multiplier: tr.multiplier,
    });
    setEditMode(true);
    setEditId(tr.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this DAO trait reward?')) return;
    try {
      setLoading(true);
      await axios.delete(`${BASE}/trait-rewards/${id}`, authHeaders());
      setSuccess('DAO trait reward deleted');
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
      await axios.put(`${BASE}/trait-rewards/${id}`, { is_active: !isActive }, authHeaders());
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
        <h2 className="text-2xl font-bold text-blue-100">DAO Trait-Based Rewards</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showForm ? 'Cancel' : 'Add New DAO Trait Reward'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 relative">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-blue-900/50 border border-blue-500 text-blue-200 px-4 py-3 rounded mb-4 relative">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-medium text-blue-100 mb-4">
            {editMode ? 'Edit DAO Trait Reward' : 'Add New DAO Trait Reward'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-6">

              {/* Collection */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Collection</label>
                <select
                  name="collection_id"
                  value={formData.collection_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a collection</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Trait Type + Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">Trait Type</label>
                  <input
                    type="text"
                    name="trait_type"
                    value={formData.trait_type}
                    onChange={handleInputChange}
                    placeholder="e.g. Background, Eyes, Mouth"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">Trait Value</label>
                  <input
                    type="text"
                    name="trait_value"
                    value={formData.trait_value}
                    onChange={handleInputChange}
                    placeholder="e.g. Blue, Rare, Gold"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Token */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Token</label>
                <select
                  name="token_address"
                  value={formData.token_address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a token</option>
                  {availableTokens.map(t => (
                    <option key={t.token_address} value={t.token_address}>
                      {t.token_symbol} — {t.token_address.slice(0, 8)}…
                    </option>
                  ))}
                </select>
              </div>

              {/* Multiplier (daily rate) */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">
                  Multiplier (tokens per day)
                </label>
                <input
                  type="number"
                  name="multiplier"
                  value={formData.multiplier}
                  onChange={handleInputChange}
                  step="0.000000001"
                  min="0"
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-indigo-400">
                  NFTs with this trait earn this many tokens per day via DAO rewards
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
                >
                  {loading ? 'Saving...' : editMode ? 'Update DAO Trait Reward' : 'Add DAO Trait Reward'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md overflow-hidden">
          {traitRewards.length === 0 ? (
            <div className="p-6 text-center text-indigo-400">
              No DAO trait rewards found. Add your first DAO trait reward using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-indigo-700">
              <thead className="bg-indigo-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Collection</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Trait</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Tokens / day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-blue-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-700">
                {traitRewards.map(tr => (
                  <tr key={tr.id} className="hover:bg-indigo-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-100">{tr.collection_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-100">{tr.trait_type}</div>
                      <div className="text-xs text-indigo-400">{tr.trait_value}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-100">{tr.token_symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-100">
                      {parseFloat(tr.multiplier)} ${tr.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tr.is_active ? 'bg-blue-900 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>
                        {tr.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => toggleActive(tr.id, tr.is_active)} className="text-blue-400 hover:text-blue-200 mr-4">
                        {tr.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleEdit(tr)} className="text-blue-400 hover:text-blue-200 mr-4">Edit</button>
                      <button onClick={() => handleDelete(tr.id)} className="text-red-400 hover:text-red-200">Delete</button>
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

export default DaoTraitManager;
