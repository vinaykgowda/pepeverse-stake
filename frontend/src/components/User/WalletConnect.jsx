// frontend/src/components/User/WalletConnect.jsx

import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import phantomIcon from '../../assets/phantom.svg';
import solflareIcon from '../../assets/solflare.svg';

const WalletConnect = () => {
  const { connect, loading, error } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState('');

  const handleConnect = async (walletName) => {
    setSelectedWallet(walletName);
    await connect(walletName);
  };

  return (
    <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.1)] p-6">
      <h2 className="text-xl font-semibold text-center text-green-400 mb-6 tracking-wide">Connect Your Wallet</h2>

      {error && (
        <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-5 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={() => handleConnect('phantom')}
          disabled={loading}
          className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all ${
            loading && selectedWallet === 'phantom'
              ? 'bg-[#0d1a0d] border-green-700'
              : 'bg-[#0d1a0d] border-[#1e3a1e] hover:border-green-600'
          }`}
        >
          <div className="flex items-center">
            <img src={phantomIcon} alt="Phantom" className="w-10 h-10 rounded-full" />
            <span className="ml-3 font-medium text-green-300">Phantom</span>
          </div>
          {loading && selectedWallet === 'phantom' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500" />
          ) : (
            <svg className="h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <button
          onClick={() => handleConnect('solflare')}
          disabled={loading}
          className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all ${
            loading && selectedWallet === 'solflare'
              ? 'bg-[#0d1a0d] border-green-700'
              : 'bg-[#0d1a0d] border-[#1e3a1e] hover:border-green-600'
          }`}
        >
          <div className="flex items-center">
            <img src={solflareIcon} alt="Solflare" className="w-10 h-10 rounded-full" />
            <span className="ml-3 font-medium text-green-300">Solflare</span>
          </div>
          {loading && selectedWallet === 'solflare' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500" />
          ) : (
            <svg className="h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      <div className="mt-6 text-center text-xs text-green-800">
        New to Solana?{' '}
        <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-400 underline">
          Get a wallet
        </a>
      </div>
    </div>
  );
};

export default WalletConnect;