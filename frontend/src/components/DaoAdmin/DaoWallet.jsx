// frontend/src/components/DaoAdmin/DaoWallet.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
});

const BASE = '/api/v1/dao-admin';

const DaoWallet = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [encryptedKey, setEncryptedKey] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [tokenBalances, setTokenBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${BASE}/wallet`, authHeaders());
      const data = res.data?.data || res.data || {};
      setCurrentAddress(data.wallet_address || '');
      setTokenBalances(data.token_balances || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load wallet info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWallet(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!walletAddress.trim()) return setError('Wallet address is required');
    if (!encryptedKey.trim()) return setError('Encrypted private key is required');

    try {
      setSaving(true);
      setError(null);
      await axios.post(
        `${BASE}/wallet`,
        { wallet_address: walletAddress.trim(), encrypted_private_key: encryptedKey.trim() },
        authHeaders()
      );
      setSuccess('DAO reward wallet updated successfully');
      setWalletAddress('');
      setEncryptedKey('');
      loadWallet();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save wallet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-100">DAO Reward Wallet</h2>
        <p className="text-indigo-400 text-sm mt-1">Configure the wallet used to distribute DAO rewards</p>
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

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current wallet info */}
          <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-blue-100 mb-4">Current DAO Reward Wallet</h3>
            {currentAddress ? (
              <div>
                <p className="text-sm text-indigo-400 mb-1">Wallet Address</p>
                <p className="text-blue-100 font-mono text-sm break-all">{currentAddress}</p>

                {tokenBalances.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-indigo-400 mb-2">Token Balances</p>
                    <div className="space-y-2">
                      {tokenBalances.map((token, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-indigo-800 rounded px-3 py-2">
                          <span className="text-blue-200 text-sm font-medium">{token.symbol || token.token_symbol}</span>
                          <span className="text-blue-100 text-sm font-mono">{token.balance ?? token.amount ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-indigo-400 text-sm">No DAO reward wallet configured yet.</p>
            )}
          </div>

          {/* Set wallet form */}
          <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-blue-100 mb-4">Set DAO Reward Wallet</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="Solana wallet address (base58)"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Encrypted Private Key
                  </label>
                  <textarea
                    value={encryptedKey}
                    onChange={(e) => setEncryptedKey(e.target.value)}
                    placeholder="Encrypted private key string"
                    rows={3}
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p className="mt-1 text-sm text-indigo-400">
                    Provide the encrypted private key. This wallet will be used exclusively for DAO reward distributions.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
                  >
                    {saving ? 'Saving...' : 'Save Wallet'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaoWallet;
