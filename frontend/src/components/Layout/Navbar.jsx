// frontend/src/components/Layout/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import NetworkIndicator from '../NetworkIndicator';

const Navbar = () => {
  const { connected, wallet, disconnect } = useWallet();
  const navigate = useNavigate();

  const handleDisconnect = async () => {
    await disconnect();
    navigate('/');
  };

  return (
    <>
      <NetworkIndicator />
      <nav className="bg-[#0d1a0d] border-b border-[#1e3a1e] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-green-400 hover:text-green-300 tracking-wide transition-colors">
              PEPE GODS STAKING
            </Link>

            <div className="flex items-center space-x-4">
              {connected && wallet ? (
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-green-600 bg-green-950/50 border border-green-800 px-3 py-1 rounded-full font-mono">
                    {wallet.publicKey.slice(0, 4)}...{wallet.publicKey.slice(-4)}
                  </span>
                  <button
                    onClick={handleDisconnect}
                    className="text-sm text-green-700 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
