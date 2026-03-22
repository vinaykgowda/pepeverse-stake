// frontend/src/components/Layout/Navbar.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import NetworkIndicator from '../NetworkIndicator';

const Navbar = () => {
  const { connected, wallet, disconnect } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleDisconnect = async () => {
    await disconnect();
    navigate('/');
  };

  const handleAdminClick = () => {
    // Navigate to admin login page
    navigate('/admin/login');
  };

  return (
    <>
      {/* Network Warning Banner */}
      <NetworkIndicator />
      
      <nav className="bg-indigo-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-xl font-bold hover:text-indigo-200">
              PEPE GODS STAKING
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="hover:text-indigo-200 transition-colors">
              Home
            </Link>
            <Link to="/staking" className="hover:text-indigo-200 transition-colors">
              Staking
            </Link>
            <button 
              onClick={handleAdminClick}
              className="hover:text-indigo-200 transition-colors"
            >
              Admin
            </button>
            
            {/* Network Indicator Badge */}
            <div className="flex items-center">
              <NetworkIndicator />
            </div>
            
            {/* Wallet Status */}
            {connected && wallet ? (
              <div className="flex items-center space-x-4">
                <div className="text-sm">
                  <span className="text-indigo-200">Connected:</span>
                  <span className="ml-1 font-mono">
                    {wallet.publicKey.slice(0, 4)}...{wallet.publicKey.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 rounded text-sm transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (<div></div>)}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-indigo-200"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-indigo-700">
            <div className="flex flex-col space-y-4">
              <Link 
                to="/" 
                className="hover:text-indigo-200 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/staking" 
                className="hover:text-indigo-200 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Staking
              </Link>
              <button 
                onClick={() => {
                  handleAdminClick();
                  setMobileMenuOpen(false);
                }}
                className="hover:text-indigo-200 transition-colors text-left"
              >
                Admin
              </button>
              
              {/* Network Indicator */}
              <div className="pt-2">
                <NetworkIndicator />
              </div>
              
              {/* Mobile Wallet Status */}
              {connected && wallet ? (
                <div className="pt-4 border-t border-indigo-700">
                  <div className="text-sm mb-2">
                    <span className="text-indigo-200">Connected:</span>
                    <span className="ml-1 font-mono block">
                      {wallet.publicKey.slice(0, 8)}...{wallet.publicKey.slice(-8)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      handleDisconnect();
                      setMobileMenuOpen(false);
                    }}
                    className="bg-indigo-700 hover:bg-indigo-800 px-3 py-1 rounded text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (<div></div>)}
            </div>
          </div>
        )}
      </div>
    </nav>
    </>
  );
};

export default Navbar;