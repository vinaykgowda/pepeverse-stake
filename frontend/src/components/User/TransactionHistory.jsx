// frontend/src/components/User/TransactionHistory.jsx

import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { formatToken, formatSol } from '../../utils/format';
import networkConfig from '../../config/network';

const TransactionHistory = () => {
  const { getTransactionHistory, loading } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadTransactions = async () => {
    try {
      setLoadingHistory(true);
      const history = await getTransactionHistory();
      setTransactions(history || []);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const getExplorerLink = (signature) => {
    if (!signature || signature === 'SIMULATED_FOR_TESTING' || signature.length !== 88) {
      return null;
    }
    return networkConfig.getTransactionUrl(signature);
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'CLAIM': return 'text-green-600 bg-green-100';
      case 'CLAIM_FEE': return 'text-yellow-600 bg-yellow-100';
      case 'STAKE_FEE': return 'text-blue-600 bg-blue-100';
      case 'UNSTAKE': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED': return 'text-green-600 bg-green-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
        <button
          onClick={loadTransactions}
          className="text-sm text-indigo-600 hover:text-indigo-500"
          title="Refresh history"
        >
          🔄 Refresh
        </button>
      </div>

      {loadingHistory || loading ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : transactions.length > 0 ? (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeColor(tx.transaction_type)}`}>
                      {tx.transaction_type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-1">
                    Amount: {
                      tx.transaction_type.includes('FEE')
                        ? `${formatSol(tx.amount)} SOL`
                        : tx.token_address === 'So11111111111111111111111111111111111111112'
                        ? `${formatToken(tx.amount)} SOL`
                        : `${formatToken(tx.amount)} tokens`
                    }
                  </div>

                  <div className="text-xs text-gray-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>

                  {tx.error_message && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {tx.error_message}
                    </div>
                  )}
                </div>

                <div className="ml-4 text-right">
                  {tx.transaction_hash && getExplorerLink(tx.transaction_hash) ? (
                    <a
                      href={getExplorerLink(tx.transaction_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Explorer
                    </a>
                  ) : tx.transaction_hash ? (
                    <div className="text-xs text-gray-500 font-mono">
                      {tx.transaction_hash.substring(0, 8)}...{tx.transaction_hash.substring(-8)}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">No signature</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <p>No transactions found.</p>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;