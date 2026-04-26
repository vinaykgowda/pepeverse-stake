// frontend/src/components/DaoAdmin/DaoAirdropManager.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
});

const BASE = '/api/v1/dao-admin';

const STATUS_BADGE = {
  active: 'bg-blue-900 text-blue-300',
  inactive: 'bg-indigo-900/50 text-indigo-400',
  expired: 'bg-yellow-900/50 text-yellow-300',
};

const EMPTY_FORM = {
  collection_id: '',
  airdrop_type: 'threshold',
  token_address: '',
  token_symbol: '',
  token_decimals: 9,
  amount_per_nft: '',
  minimum_threshold: '',
  trait_type: '',
  trait_value: '',
  new_token_address: '',
  new_token_symbol: '',
};

const DaoAirdropManager = () => {
  const [airdrops, setAirdrops] = useState([]);
  const [collections, setCollections] = useState([]);
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [tokenMode, setTokenMode] = useState('existing');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [airdropRes, colRes, tokensRes] = await Promise.all([
        axios.get(`${BASE}/airdrops`, authHeaders()),
        axios.get(`${BASE}/collections`, authHeaders()),
        axios.get(`${BASE}/available-tokens`, authHeaders()),
      ]);
      setAirdrops(airdropRes.data.data || []);
      setCollections(colRes.data.data || []);
      setAllTokens(tokensRes.data.data || []);
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
        const token = allTokens.find(t => t.token_address === value);
        if (token) {
          next.token_symbol = token.token_symbol;
          next.token_decimals = token.token_decimals ?? 9;
        }
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setTokenMode('existing');
    setShowForm(false);
  };

  const buildPayload = () => {
    let tokenAddress, tokenSymbol, tokenDecimals;
    if (tokenMode === 'new') {
      tokenAddress = formData.new_token_address.trim();
      tokenSymbol = formData.new_token_symbol.trim().toUpperCase();
      tokenDecimals = 9;
    } else {
      tokenAddress = formData.token_address;
      tokenSymbol = formData.token_symbol;
      tokenDecimals = formData.token_decimals || 9;
    }
    const payload = {
      collection_id: parseInt(formData.collection_id),
      airdrop_type: formData.airdrop_type,
      token_address: tokenAddress,
      token_symbol: tokenSymbol,
      token_decimals: tokenDecimals,
      amount_per_nft: parseFloat(formData.amount_per_nft),
    };
    if (formData.airdrop_type === 'threshold') {
      payload.minimum_threshold = parseInt(formData.minimum_threshold);
    } else {
      payload.trait_type = formData.trait_type.trim();
      payload.trait_value = formData.trait_value.trim();
    }
    return payload;
  };

  const validateForm = () => {
    if (!formData.collection_id) return 'Please select a collection';
    if (!formData.amount_per_nft || parseFloat(formData.amount_per_nft) <= 0)
      return 'Amount per NFT must be positive';
    if (formData.airdrop_type === 'threshold' && (!formData.minimum_threshold || parseInt(formData.minimum_threshold) <= 0))
      return 'Minimum threshold must be greater than zero';
    if (formData.airdrop_type === 'trait' && (!formData.trait_type.trim() || !formData.trait_value.trim()))
      return 'Trait type and trait value are required';
    if (tokenMode === 'new') {
      if (!formData.new_token_address.trim()) return 'Token address is required';
      if (!formData.new_token_symbol.trim()) return 'Token symbol is required';
    } else {
      if (!formData.token_address) return 'Please select a token';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) return setError(err);
    setError(null);
    setSaving(true);
    try {
      await axios.post(`${BASE}/airdrops`, buildPayload(), authHeaders());
      setSuccess('DAO airdrop configuration saved');
      resetForm();
      loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save DAO airdrop');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Activate this DAO airdrop and generate snapshots?')) return;
    try {
      setLoading(true);
      await axios.post(`${BASE}/airdrops/${id}/activate`, {}, authHeaders());
      setSuccess('DAO airdrop activated');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate DAO airdrop');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this DAO airdrop configuration?')) return;
    try {
      setLoading(true);
      await axios.delete(`${BASE}/airdrops/${id}`, authHeaders());
      setSuccess('DAO airdrop deleted');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete DAO airdrop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-blue-100">DAO Airdrop Manager</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showForm ? 'Cancel' : 'Create DAO Airdrop'}
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
          <h3 className="text-lg font-medium text-blue-100 mb-4">Create New DAO Airdrop</h3>
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

              {/* Airdrop Type */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Airdrop Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, airdrop_type: 'threshold' }))}
                    className={`px-3 py-1 text-sm rounded-md border ${formData.airdrop_type === 'threshold' ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Threshold
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, airdrop_type: 'trait' }))}
                    className={`px-3 py-1 text-sm rounded-md border ${formData.airdrop_type === 'trait' ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Trait
                  </button>
                </div>
              </div>

              {/* Conditional: Threshold */}
              {formData.airdrop_type === 'threshold' && (
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">Minimum Threshold (staked NFTs)</label>
                  <input
                    type="number"
                    name="minimum_threshold"
                    value={formData.minimum_threshold}
                    onChange={handleInputChange}
                    min="1"
                    step="1"
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-sm text-indigo-400">Wallet must have at least this many staked NFTs to qualify</p>
                </div>
              )}

              {/* Conditional: Trait */}
              {formData.airdrop_type === 'trait' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">Trait Type</label>
                    <input
                      type="text"
                      name="trait_type"
                      value={formData.trait_type}
                      onChange={handleInputChange}
                      placeholder="e.g. Background, Eyes"
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
                      placeholder="e.g. Blue, Rare"
                      className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Token */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Token</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setTokenMode('existing')}
                    className={`px-3 py-1 text-sm rounded-md border ${tokenMode === 'existing' ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Select existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTokenMode('new')}
                    className={`px-3 py-1 text-sm rounded-md border ${tokenMode === 'new' ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Add New Token
                  </button>
                </div>

                {tokenMode === 'existing' ? (
                  <select
                    name="token_address"
                    value={formData.token_address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={allTokens.length === 0}
                  >
                    {allTokens.length === 0
                      ? <option value="">No tokens available — add a new token</option>
                      : <>
                          <option value="">Select a token</option>
                          {allTokens.map(t => (
                            <option key={t.token_address} value={t.token_address}>
                              {t.token_symbol} — {t.token_address.slice(0, 8)}…
                            </option>
                          ))}
                        </>
                    }
                  </select>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        name="new_token_address"
                        value={formData.new_token_address}
                        onChange={handleInputChange}
                        placeholder="Token mint address"
                        className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="new_token_symbol"
                        value={formData.new_token_symbol}
                        onChange={handleInputChange}
                        placeholder="Symbol (e.g. EMPIRE)"
                        className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Amount per NFT */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Amount per NFT</label>
                <input
                  type="number"
                  name="amount_per_nft"
                  value={formData.amount_per_nft}
                  onChange={handleInputChange}
                  step="any"
                  min="0"
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="mt-1 text-sm text-indigo-400">Tokens distributed per eligible NFT</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
                >
                  {saving ? 'Saving...' : 'Save DAO Airdrop'}
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
          {airdrops.length === 0 ? (
            <div className="p-6 text-center text-indigo-400">
              No DAO airdrop configurations found. Create your first DAO airdrop using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-indigo-700">
              <thead className="bg-indigo-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Collection</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Amount / NFT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Criteria</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-blue-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-700">
                {airdrops.map(airdrop => (
                  <tr key={airdrop.id} className="hover:bg-indigo-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_BADGE[airdrop.status] || STATUS_BADGE.inactive}`}>
                        {airdrop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-100">
                      {airdrop.collection_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-200 capitalize">
                      {airdrop.airdrop_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-100">
                      {airdrop.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-100">
                      {parseFloat(airdrop.amount_per_nft)} ${airdrop.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {airdrop.airdrop_type === 'threshold'
                        ? `≥ ${airdrop.minimum_threshold} staked`
                        : `${airdrop.trait_type}: ${airdrop.trait_value}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {airdrop.status !== 'active' && (
                        <button
                          onClick={() => handleActivate(airdrop.id)}
                          className="text-blue-400 hover:text-blue-200"
                        >
                          Activate
                        </button>
                      )}
                      {airdrop.status === 'inactive' && (
                        <button
                          onClick={() => handleDelete(airdrop.id)}
                          className="text-red-400 hover:text-red-200"
                        >
                          Delete
                        </button>
                      )}
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

export default DaoAirdropManager;
