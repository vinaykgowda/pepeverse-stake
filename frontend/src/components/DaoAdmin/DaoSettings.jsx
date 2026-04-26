// frontend/src/components/DaoAdmin/DaoSettings.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
});

const BASE = '/api/v1/dao-admin';

const DaoSettings = () => {
  const [claimFee, setClaimFee] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${BASE}/settings`, authHeaders());
      const fee = res.data?.data?.dao_claim_fee ?? res.data?.dao_claim_fee ?? '0';
      setClaimFee(String(fee));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fee = parseFloat(claimFee);
    if (isNaN(fee) || fee < 0) {
      return setError('Claim fee must be 0 or a positive SOL amount');
    }
    try {
      setSaving(true);
      setError(null);
      await axios.put(`${BASE}/settings`, { dao_claim_fee: fee }, authHeaders());
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-100">DAO Settings</h2>
        <p className="text-indigo-400 text-sm mt-1">Configure DAO claim fee and other settings</p>
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
        <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md p-6 max-w-lg">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-blue-200 mb-1">
                DAO Claim Fee (SOL)
              </label>
              <input
                type="number"
                value={claimFee}
                onChange={(e) => setClaimFee(e.target.value)}
                step="0.000000001"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-indigo-400">
                Set to <span className="text-blue-300 font-medium">0</span> for free claims, or enter a SOL amount users must pay to claim DAO rewards.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default DaoSettings;
