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

  // Preview state
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // Eligible wallets modal
  const [eligibleModal, setEligibleModal] = useState(null);

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
    setPreview(null); // reset preview on any change
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

  const handlePreview = async () => {
    const err = validateForm();
    if (err) return setError(err);
    setError(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await axios.post(`${BASE}/airdrops/preview`, buildPayload(), authHeaders());
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
    if (preview.treasury_balance !== null && !preview.sufficient)
      return setError(`Insufficient DAO wallet balance. Need ${preview.total_tokens.toFixed(2)} tokens, have ${(preview.treasury_balance ?? 0).toFixed(2)}.`);
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

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this DAO airdrop?')) return;
    try {
      setLoading(true);
      await axios.post(`${BASE}/airdrops/${id}/deactivate`, {}, authHeaders());
      setSuccess('DAO airdrop deactivated');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate DAO airdrop');
    } finally {
      setLoading(false);
    }
  };

  const handleViewEligible = async (id) => {
    setEligibleModal({ id, wallets: [], loading: true });
    try {
      const res = await axios.get(`${BASE}/airdrops/${id}/eligible-wallets`, authHeaders());
      setEligibleModal({ id, wallets: res.data.data || [], loading: false });
    } catch (err) {
      setEligibleModal({ id, wallets: [], loading: false, error: 'Failed to load eligible wallets' });
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
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-blue-900/50 border border-blue-500 text-blue-200 px-4 py-3 rounded mb-4 relative">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">✕</button>
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
                <select name="collection_id" value={formData.collection_id} onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md" required>
                  <option value="">Select a collection</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Airdrop Type */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Airdrop Type</label>
                <div className="flex gap-2">
                  {['threshold', 'trait'].map(t => (
                    <button key={t} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, airdrop_type: t }))}
                      className={`px-3 py-1 text-sm rounded-md border capitalize ${formData.airdrop_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {formData.airdrop_type === 'threshold' && (
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">Minimum Threshold (staked NFTs)</label>
                  <input type="number" name="minimum_threshold" value={formData.minimum_threshold} onChange={handleInputChange}
                    min="1" step="1" placeholder="e.g. 3"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" required />
                  <p className="mt-1 text-sm text-indigo-400">Wallet must have at least this many staked NFTs to qualify</p>
                </div>
              )}

              {formData.airdrop_type === 'trait' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">Trait Type</label>
                    <input type="text" name="trait_type" value={formData.trait_type} onChange={handleInputChange}
                      placeholder="e.g. Background, Eyes"
                      className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-1">Trait Value</label>
                    <input type="text" name="trait_value" value={formData.trait_value} onChange={handleInputChange}
                      placeholder="e.g. Blue, Rare"
                      className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" required />
                  </div>
                </div>
              )}

              {/* Token */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Token</label>
                <div className="flex gap-2 mb-2">
                  {['existing', 'new'].map(m => (
                    <button key={m} type="button" onClick={() => setTokenMode(m)}
                      className={`px-3 py-1 text-sm rounded-md border ${tokenMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-indigo-800 text-blue-300 border-indigo-600 hover:bg-indigo-700'}`}>
                      {m === 'existing' ? 'Select existing' : 'Add New Token'}
                    </button>
                  ))}
                </div>
                {tokenMode === 'existing' ? (
                  <select name="token_address" value={formData.token_address} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 rounded-md"
                    disabled={allTokens.length === 0}>
                    {allTokens.length === 0
                      ? <option value="">No tokens available</option>
                      : <><option value="">Select a token</option>
                        {allTokens.map(t => <option key={t.token_address} value={t.token_address}>{t.token_symbol} — {t.token_address.slice(0, 8)}…</option>)}</>}
                  </select>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" name="new_token_address" value={formData.new_token_address} onChange={handleInputChange}
                      placeholder="Token mint address"
                      className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" />
                    <input type="text" name="new_token_symbol" value={formData.new_token_symbol} onChange={handleInputChange}
                      placeholder="Symbol (e.g. LDZ)"
                      className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" />
                  </div>
                )}
              </div>

              {/* Amount per NFT */}
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-1">Amount per NFT</label>
                <input type="number" name="amount_per_nft" value={formData.amount_per_nft} onChange={handleInputChange}
                  step="any" min="0" placeholder="e.g. 100"
                  className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md" required />
                <p className="mt-1 text-sm text-indigo-400">Tokens distributed per eligible NFT</p>
              </div>

              {/* Preview Results */}
              {preview && (
                <div className={`border rounded-lg overflow-hidden ${preview.sufficient ? 'border-blue-600' : 'border-red-500'}`}>
                  <div className={`px-4 py-3 flex justify-between items-center ${preview.sufficient ? 'bg-blue-900/40' : 'bg-red-900/40'}`}>
                    <div className="text-sm text-blue-100 space-x-3">
                      <span className="font-semibold">{preview.total_wallets} eligible wallet{preview.total_wallets !== 1 ? 's' : ''}</span>
                      <span className="text-indigo-400">·</span>
                      <span>{preview.total_tokens.toFixed(4)} tokens total</span>
                      {preview.treasury_balance !== null && (
                        <>
                          <span className="text-indigo-400">·</span>
                          <span className={preview.sufficient ? 'text-green-400' : 'text-red-400'}>
                            DAO wallet: {preview.treasury_balance.toFixed(4)}
                            {!preview.sufficient && ` (shortfall: ${preview.shortfall.toFixed(4)})`}
                          </span>
                        </>
                      )}
                    </div>
                    {!preview.sufficient && (
                      <span className="text-xs font-semibold text-red-300 bg-red-900 px-2 py-1 rounded">Insufficient Balance</span>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-indigo-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-blue-300 uppercase">Wallet</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-blue-300 uppercase">Eligible NFTs</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-blue-300 uppercase">Tokens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-700">
                        {preview.eligible_wallets.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-4 text-center text-indigo-400">No eligible wallets found</td></tr>
                        ) : preview.eligible_wallets.map((w, i) => (
                          <tr key={i} className="hover:bg-indigo-800/30">
                            <td className="px-4 py-2 font-mono text-xs text-blue-200">{w.wallet.slice(0, 8)}…{w.wallet.slice(-4)}</td>
                            <td className="px-4 py-2 text-right text-blue-100">{w.nft_count}</td>
                            <td className="px-4 py-2 text-right text-blue-100">{w.token_amount.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={handlePreview} disabled={previewing}
                  className="px-4 py-2 bg-indigo-700 text-white rounded-md hover:bg-indigo-600 disabled:bg-indigo-900 disabled:text-indigo-500">
                  {previewing ? 'Loading...' : 'Preview Eligibility'}
                </button>
                <button type="submit" disabled={saving || !preview || preview.total_wallets === 0 || (preview.treasury_balance !== null && !preview.sufficient)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-500 disabled:cursor-not-allowed"
                  title={!preview ? 'Preview eligibility first' : preview.total_wallets === 0 ? 'No eligible wallets' : !preview.sufficient ? 'Insufficient DAO wallet balance' : ''}>
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
            <div className="p-6 text-center text-indigo-400">No DAO airdrop configurations found.</div>
          ) : (
            <table className="min-w-full divide-y divide-indigo-700">
              <thead className="bg-indigo-800">
                <tr>
                  {['Status', 'Collection', 'Type', 'Token', 'Amount / NFT', 'Criteria', 'Eligible', 'Remaining', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium text-blue-300 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-700">
                {airdrops.map(airdrop => (
                  <tr key={airdrop.id} className="hover:bg-indigo-800/50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_BADGE[airdrop.status] || STATUS_BADGE.inactive}`}>
                        {airdrop.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-100">{airdrop.collection_name || '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-200 capitalize">{airdrop.airdrop_type}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-100">{airdrop.token_symbol}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-100">{parseFloat(airdrop.amount_per_nft)} ${airdrop.token_symbol}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {airdrop.airdrop_type === 'threshold' ? `≥ ${airdrop.minimum_threshold} staked` : `${airdrop.trait_type}: ${airdrop.trait_value}`}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-200 text-center">{airdrop.eligible_count ?? '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-200 text-center">{airdrop.remaining_count ?? '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button onClick={() => handleViewEligible(airdrop.id)} className="text-blue-400 hover:text-blue-200">
                        View Eligible
                      </button>
                      {airdrop.status !== 'active' && (
                        <button onClick={() => handleActivate(airdrop.id)} className="text-green-400 hover:text-green-200">Activate</button>
                      )}
                      {airdrop.status === 'active' && (
                        <button onClick={() => handleDeactivate(airdrop.id)} className="text-yellow-400 hover:text-yellow-200">Deactivate</button>
                      )}
                      {airdrop.status === 'inactive' && (
                        <button onClick={() => handleDelete(airdrop.id)} className="text-red-400 hover:text-red-200">Delete</button>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-indigo-950 border border-indigo-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-indigo-700">
              <h3 className="text-lg font-semibold text-blue-100">Eligible Wallets & Claim Status</h3>
              <button onClick={() => setEligibleModal(null)} className="text-indigo-400 hover:text-blue-200 text-xl">✕</button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {eligibleModal.loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : eligibleModal.error ? (
                <div className="text-red-400 text-center py-6">{eligibleModal.error}</div>
              ) : eligibleModal.wallets.length === 0 ? (
                <div className="text-indigo-400 text-center py-6">No snapshots yet. Activate the airdrop to generate them.</div>
              ) : (
                <table className="min-w-full divide-y divide-indigo-700">
                  <thead className="bg-indigo-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-300 uppercase">Wallet Address</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-blue-300 uppercase">Token Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-300 uppercase">Claimed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-700">
                    {eligibleModal.wallets.map((w, i) => (
                      <tr key={i} className={w.is_claimed ? 'bg-blue-900/20' : 'hover:bg-indigo-800/30'}>
                        <td className="px-4 py-3 text-sm font-mono text-blue-200 break-all">{w.wallet_address}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-100">{parseFloat(w.token_amount).toFixed(4)}</td>
                        <td className="px-4 py-3 text-center">
                          {w.is_claimed
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs" title={w.claimed_at}>✓</span>
                            : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-700 text-indigo-400 text-xs">–</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-indigo-700 flex justify-between items-center">
              {!eligibleModal.loading && eligibleModal.wallets.length > 0 && (
                <span className="text-sm text-indigo-400">
                  {eligibleModal.wallets.filter(w => w.is_claimed).length} / {eligibleModal.wallets.length} claimed
                </span>
              )}
              <button onClick={() => setEligibleModal(null)}
                className="ml-auto px-4 py-2 bg-indigo-800 text-blue-200 rounded-md hover:bg-indigo-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaoAirdropManager;
