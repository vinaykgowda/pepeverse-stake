// frontend/src/components/Admin/AirdropManager.jsx

import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const STATUS_BADGE = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  expired: 'bg-yellow-100 text-yellow-800',
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

const AirdropManager = () => {
  const [airdrops, setAirdrops] = useState([]);
  const [collections, setCollections] = useState([]);
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [tokenMode, setTokenMode] = useState('existing');

  // Preview state
  const [preview, setPreview] = useState(null); // { eligible_wallets, total_wallets, total_tokens, treasury_balance, sufficient, shortfall }
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eligibleModal, setEligibleModal] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [airdropRes, colRes, tokensRes] = await Promise.all([
        api.admin.getAirdrops(),
        api.admin.getCollections(),
        api.admin.getTokens(),
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

  const collectionTokens = allTokens;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPreview(null); // reset preview on any change
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'token_address') {
        const token = collectionTokens.find(t => t.token_address === value);
        if (token) { next.token_symbol = token.token_symbol; next.token_decimals = token.token_decimals || 9; }
      }
      return next;
    });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setTokenMode('existing');
    setPreview(null);
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
    if (formData.airdrop_type === 'threshold') payload.minimum_threshold = parseInt(formData.minimum_threshold);
    else { payload.trait_type = formData.trait_type.trim(); payload.trait_value = formData.trait_value.trim(); }
    return payload;
  };

  const validateForm = () => {
    if (!formData.collection_id) return 'Please select a collection';
    if (!formData.amount_per_nft || parseFloat(formData.amount_per_nft) <= 0) return 'Amount per NFT must be positive';
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

  const handlePreview = async () => {
    const err = validateForm();
    if (err) return setError(err);
    setError(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await api.admin.previewAirdrop(buildPayload());
      setPreview(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to preview eligibility');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateForm();
    if (err) return setError(err);
    if (!preview) return setError('Please click "Preview Eligibility" first');
    if (!preview.sufficient) return setError(`Insufficient treasury balance. Need ${preview.total_tokens.toFixed(2)} tokens, have ${(preview.treasury_balance ?? 0).toFixed(2)}.`);
    setError(null);
    setSaving(true);
    try {
      await api.admin.createAirdrop(buildPayload());
      setSuccess('Airdrop configuration saved');
      resetForm();
      loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save airdrop');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    try {
      setLoading(true);
      await api.admin.activateAirdrop(id);
      setSuccess('Airdrop activated');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate airdrop');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      setLoading(true);
      await api.admin.deactivateAirdrop(id);
      setSuccess('Airdrop deactivated');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate airdrop');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this airdrop configuration and all associated claim records?')) return;
    try {
      setLoading(true);
      await api.admin.deleteAirdrop(id);
      setSuccess('Airdrop deleted');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete airdrop');
    } finally {
      setLoading(false);
    }
  };

  const handleViewEligible = async (id) => {
    setEligibleModal({ id, wallets: [], loading: true });
    try {
      const res = await api.admin.getEligibleWallets(id);
      const data = res.data.data;
      const wallets = Array.isArray(data) ? data : (data?.wallets || []);
      setEligibleModal({ id, wallets, source: data?.source, loading: false });
    } catch (err) {
      setEligibleModal({ id, wallets: [], loading: false, error: 'Failed to load eligible wallets' });
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Airdrop Manager</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {showForm ? 'Cancel' : 'Create Airdrop'}
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Airdrop</h3>
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
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Airdrop Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Airdrop Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, airdrop_type: 'threshold' }))}
                    className={`px-3 py-1 text-sm rounded-md border ${formData.airdrop_type === 'threshold' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Threshold
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, airdrop_type: 'trait' }))}
                    className={`px-3 py-1 text-sm rounded-md border ${formData.airdrop_type === 'trait' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Trait
                  </button>
                </div>
              </div>

              {/* Conditional: Threshold */}
              {formData.airdrop_type === 'threshold' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Threshold (staked NFTs)</label>
                  <input
                    type="number"
                    name="minimum_threshold"
                    value={formData.minimum_threshold}
                    onChange={handleInputChange}
                    min="1"
                    step="1"
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">Wallet must have at least this many staked NFTs to qualify</p>
                </div>
              )}

              {/* Conditional: Trait */}
              {formData.airdrop_type === 'trait' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trait Type</label>
                    <input
                      type="text"
                      name="trait_type"
                      value={formData.trait_type}
                      onChange={handleInputChange}
                      placeholder="e.g. Background, Eyes"
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
                      placeholder="e.g. Blue, Rare"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Token */}
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
                    Add New Token
                  </button>
                </div>

                {tokenMode === 'existing' ? (
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
                            <option key={t.token_address} value={t.token_address}>{t.token_symbol}</option>
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

              {/* Amount per NFT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount per NFT</label>
                <input
                  type="number"
                  name="amount_per_nft"
                  value={formData.amount_per_nft}
                  onChange={handleInputChange}
                  step="any"
                  min="0"
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">Tokens distributed per eligible NFT</p>
              </div>

              {/* Preview Results */}
              {preview && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className={`px-4 py-3 flex justify-between items-center ${preview.sufficient ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200'}`}>
                    <div>
                      <span className="font-medium text-gray-900">{preview.total_wallets} eligible wallet{preview.total_wallets !== 1 ? 's' : ''}</span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-gray-700">{preview.total_tokens.toFixed(4)} tokens total</span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className={preview.sufficient ? 'text-green-700' : 'text-red-700'}>
                        Treasury: {preview.treasury_balance != null ? preview.treasury_balance.toFixed(4) : 'unknown'}
                        {!preview.sufficient && ` (shortfall: ${preview.shortfall.toFixed(4)})`}
                      </span>
                    </div>
                    {!preview.sufficient && (
                      <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">Insufficient Balance</span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Eligible NFTs</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tokens to Receive</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.eligible_wallets.map((w, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-xs text-gray-700">{w.wallet.slice(0,8)}...{w.wallet.slice(-4)}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{w.nft_count}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{w.token_amount.toFixed(4)}</td>
                          </tr>
                        ))}
                        {preview.eligible_wallets.length === 0 && (
                          <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-500">No eligible wallets found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewing}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-300"
                >
                  {previewing ? 'Loading...' : 'Preview Eligibility'}
                </button>
                <button
                  type="submit"
                  disabled={saving || !preview || !preview.sufficient || preview.total_wallets === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title={!preview ? 'Preview eligibility first' : !preview.sufficient ? 'Insufficient treasury balance' : preview.total_wallets === 0 ? 'No eligible wallets' : ''}
                >
                  {saving ? 'Saving...' : 'Save Airdrop'}
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
          {airdrops.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No airdrop configurations found. Create your first airdrop using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount / NFT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eligible Wallets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining Claims</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {airdrops.map(airdrop => (
                  <tr key={airdrop.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_BADGE[airdrop.status] || STATUS_BADGE.inactive}`}>
                        {airdrop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {airdrop.collection_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">
                      {airdrop.airdrop_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {airdrop.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {parseFloat(airdrop.amount_per_nft)} ${airdrop.token_symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {airdrop.eligible_count != null ? airdrop.eligible_count : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {airdrop.remaining_count != null ? airdrop.remaining_count : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button
                        onClick={() => handleViewEligible(airdrop.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Eligible
                      </button>
                      {airdrop.status !== 'active' && (
                        <button
                          onClick={() => handleActivate(airdrop.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Activate
                        </button>
                      )}
                      {airdrop.status === 'active' && (
                        <button
                          onClick={() => handleDeactivate(airdrop.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(airdrop.id)}
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

      {/* Eligible Wallets Modal */}
      {eligibleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-screen flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Eligible Wallets</h3>
              <button
                onClick={() => setEligibleModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-auto flex-1 p-6">
              {eligibleModal.loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : eligibleModal.error ? (
                <div className="text-red-600 text-center py-6">{eligibleModal.error}</div>
              ) : eligibleModal.wallets.length === 0 ? (
                <div className="text-gray-500 text-center py-6">No eligible wallets found.</div>
              ) : (
                <>
                  {eligibleModal.wallets[0]?.source && (
                    <p className="text-xs text-gray-500 mb-3">
                      Source: <span className="font-medium capitalize">{eligibleModal.wallets[0].source}</span>
                    </p>
                  )}
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet Address</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Token Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {eligibleModal.wallets.map((w, i) => (
                        <tr key={w.wallet_address || i}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900 break-all">{w.wallet_address}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{parseFloat(w.token_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setEligibleModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AirdropManager;
