// frontend/src/components/Admin/ClaimsAnalytics.jsx

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const ClaimsAnalytics = () => {
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ count: 0, total_distributed: 0, unique_wallets: 0 });
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    collection_id: '',
    wallet_address: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 50;

  useEffect(() => {
    api.admin.getCollections()
      .then(res => setCollections(res.data.data || []))
      .catch(() => setCollections([]));
  }, []);

  const fetchClaims = useCallback(async (activeFilters, currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...activeFilters, page: currentPage, limit: LIMIT };
      // Remove empty filter values
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await api.admin.getClaimsAnalytics(params);
      const data = res.data;
      setClaims(data.data?.claims || data.data || []);
      if (data.data?.stats) setStats(data.data.stats);
      if (data.data?.pagination) {
        setTotalPages(Math.ceil(data.data.pagination.total / LIMIT) || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load claims analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims(appliedFilters, page);
  }, [appliedFilters, page, fetchClaims]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const handleClearFilters = () => {
    const empty = { start_date: '', end_date: '', collection_id: '', wallet_address: '' };
    setFilters(empty);
    setPage(1);
    setAppliedFilters({});
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = { ...appliedFilters, export: 'csv' };
      Object.keys(params).forEach(k => { if (!params[k] && params[k] !== 'csv') delete params[k]; });
      const res = await api.admin.getClaimsAnalytics(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'claims-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  };

  const truncateHash = (hash) => {
    if (!hash) return '—';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Claims Analytics</h2>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-300"
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
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

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="start_date"
              value={filters.start_date}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="end_date"
              value={filters.end_date}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
            <select
              name="collection_id"
              value={filters.collection_id}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Collections</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
            <input
              type="text"
              name="wallet_address"
              value={filters.wallet_address}
              onChange={handleFilterChange}
              placeholder="Enter wallet address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-500">Total Claims</p>
          <p className="text-2xl font-bold text-gray-900">{stats.count?.toLocaleString() ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-500">Total Tokens Distributed</p>
          <p className="text-2xl font-bold text-gray-900">{Number(stats.total_distributed ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-500">Unique Wallets</p>
          <p className="text-2xl font-bold text-gray-900">{stats.unique_wallets?.toLocaleString() ?? 0}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {claims.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No claims found matching the current filters
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {claims.map((claim, idx) => (
                      <tr key={claim.id || idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {claim.wallet_address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {claim.collection_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {claim.token_symbol || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Number(claim.amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(claim.timestamp || claim.claimed_at || claim.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {claim.transaction_hash ? (
                            <a
                              href={`https://explorer.solana.com/tx/${claim.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900 font-mono"
                            >
                              {truncateHash(claim.transaction_hash)}
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <p className="text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimsAnalytics;
