// frontend/src/components/DaoAdmin/DaoAdminManager.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('daoAdminToken')}` },
});

const BASE = '/api/v1/dao-admin';

const DaoAdminManager = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    wallet_address: '',
  });

  const loadAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${BASE}/admins`, authHeaders());
      setAdmins(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load DAO admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', email: '', wallet_address: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) return setError('Username is required');
    if (!formData.password.trim()) return setError('Password is required');

    const payload = { username: formData.username.trim(), password: formData.password };
    if (formData.email.trim()) payload.email = formData.email.trim();
    if (formData.wallet_address.trim()) payload.wallet_address = formData.wallet_address.trim();

    try {
      setSubmitting(true);
      setError(null);
      await axios.post(`${BASE}/admins`, payload, authHeaders());
      setSuccess('DAO admin added successfully');
      resetForm();
      loadAdmins();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add DAO admin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-blue-100">DAO Admins</h2>
          <p className="text-indigo-400 text-sm mt-1">Manage DAO administrator accounts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showForm ? 'Cancel' : 'Add DAO Admin'}
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
          <h3 className="text-lg font-medium text-blue-100 mb-4">Add New DAO Admin</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter username"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Email <span className="text-indigo-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="admin@example.com"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-1">
                    Wallet Address <span className="text-indigo-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="wallet_address"
                    value={formData.wallet_address}
                    onChange={handleInputChange}
                    placeholder="Solana wallet address"
                    className="w-full px-3 py-2 bg-indigo-800 border border-indigo-600 text-blue-100 placeholder-indigo-400 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
                >
                  {submitting ? 'Adding...' : 'Add DAO Admin'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-indigo-900 border border-indigo-700 rounded-lg shadow-md overflow-hidden">
          {admins.length === 0 ? (
            <div className="p-6 text-center text-indigo-400">
              No DAO admins found. Add the first DAO admin using the button above.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-indigo-700">
              <thead className="bg-indigo-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Wallet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-700">
                {admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-indigo-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-100">
                      {admin.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {admin.email || <span className="text-indigo-500 italic">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {admin.wallet_address
                        ? `${admin.wallet_address.slice(0, 6)}…${admin.wallet_address.slice(-4)}`
                        : <span className="text-indigo-500 italic">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${admin.is_active ? 'bg-blue-900 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300">
                      {admin.last_login ? new Date(admin.last_login).toLocaleString() : <span className="text-indigo-500 italic">Never</span>}
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

export default DaoAdminManager;
