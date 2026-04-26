// frontend/src/components/DaoAdmin/DaoAdminLogin.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDaoAuth } from '../../context/DaoAuthContext';

const DaoAdminLogin = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { daoAdminLogin } = useDaoAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const result = await daoAdminLogin(credentials.username, credentials.password);

      if (result.success) {
        navigate('/dao-admin');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      console.error('Error logging in:', err);
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 border-t-4 border-indigo-600">
        <h2 className="text-2xl font-bold text-indigo-900 mb-2 text-center">DAO Admin Login</h2>
        <p className="text-sm text-indigo-500 text-center mb-6">DAO Administration Panel</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-indigo-700 mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={credentials.username}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-indigo-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-indigo-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-indigo-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DaoAdminLogin;
