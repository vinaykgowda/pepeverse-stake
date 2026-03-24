// frontend/src/components/User/WalletConnect.jsx

import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';

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
            <div className="bg-purple-900/50 border border-purple-700 rounded-full p-2">
              <svg width="20" height="20" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="64" cy="64" r="64" fill="#AB9FF2"/>
                <path d="M110.584 64.9142H99.142C99.142 41.6393 80.2229 23 56.5774 23C33.6354 23 15.1732 40.3354 14.0518 62.4271C12.8749 86.9691 33.8991 108 58.4438 108H63.43C84.2335 108 103.83 91.1286 107.761 70.8715C108.795 66.9663 110.584 66.2123 110.584 64.9142Z" fill="white"/>
              </svg>
            </div>
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
            <div className="bg-orange-900/50 border border-orange-700 rounded-full p-2">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" fill="#FE8101"/>
                <path d="M22.9476 19.6948L21.4873 17.9383C21.4056 17.8397 21.3581 17.718 21.3581 17.5915V9.23024C21.3581 9.09085 21.3015 8.9572 21.2016 8.85732L19.6851 7.34082C19.5112 7.16689 19.1994 7.29204 19.1994 7.5305V8.19947C19.1994 8.2998 19.1574 8.39584 19.0827 8.46794L17.7415 9.78226C17.6337 9.88819 17.5724 10.0312 17.5724 10.1799V12.6807C17.5724 12.8063 17.526 12.927 17.4454 13.0255L16.225 14.4673C16.0484 14.6754 15.7218 14.5471 15.7218 14.2869V8.61224C15.7218 8.47375 15.665 8.3401 15.5651 8.24022L14.4279 7.1031C14.2539 6.92916 13.9422 7.05431 13.9422 7.29277V15.3238C13.9422 15.4493 13.8958 15.5701 13.8153 15.6686L12.5922 17.1123C12.4156 17.3205 12.089 17.1922 12.089 16.932V13.3221C12.089 13.1829 12.0316 13.0493 11.9317 12.9494L10.5452 11.5629C10.3713 11.389 10.0596 11.5141 10.0596 11.7526V17.2846C10.0596 17.4102 10.0131 17.5309 9.93251 17.6294L8.21155 19.6948C7.92931 20.0279 8.16558 20.5419 8.60377 20.5419H22.5554C22.9936 20.5419 23.2299 20.0279 22.9476 19.6948Z" fill="white"/>
              </svg>
            </div>
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