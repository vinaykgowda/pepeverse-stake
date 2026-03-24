// src/components/Auth/PrivateRoute.jsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import WalletConnect from '../User/WalletConnect';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-400 tracking-tight mb-2">PEPE GODS STAKING</h1>
            <p className="text-green-700">Connect your wallet to start staking</p>
          </div>
          <WalletConnect />
        </div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
