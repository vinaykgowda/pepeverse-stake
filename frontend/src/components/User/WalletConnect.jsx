// frontend/src/components/User/WalletConnect.jsx
import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import phantomIcon from '../../assets/phantom.svg';
import solflareIcon from '../../assets/solflare.svg';
import backpackIcon from '../../assets/backpack.svg';
import ledgerIcon from '../../assets/ledger.svg';

const WALLET_ICONS = {
  phantom: phantomIcon,
  solflare: solflareIcon,
  backpack: backpackIcon,
  ledger: ledgerIcon,
};

const WALLETS = [
  { name: 'Phantom',  key: 'phantom' },
  { name: 'Solflare', key: 'solflare' },
  { name: 'Backpack', key: 'backpack' },
  { name: 'Ledger',   key: 'ledger' },
];

const WalletConnect = () => {
  const { connect, loading, error } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState('');

  const handleConnect = async (key) => {
    setSelectedWallet(key);
    await connect(key);
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
        {WALLETS.map(({ name, key }) => (
          <button
            key={key}
            onClick={() => handleConnect(key)}
            disabled={loading}
            className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all ${
              loading && selectedWallet === key
                ? 'bg-[#0d1a0d] border-green-700'
                : 'bg-[#0d1a0d] border-[#1e3a1e] hover:border-green-600'
            }`}
          >
            <div className="flex items-center">
              <img src={WALLET_ICONS[key]} alt={name} className="w-10 h-10 rounded-xl" />
              <span className="ml-3 font-medium text-green-300">{name}</span>
            </div>
            {loading && selectedWallet === key ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-500" />
            ) : (
              <svg className="h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
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
