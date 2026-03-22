// frontend/src/components/NetworkIndicator.jsx

import React, { useState, useEffect } from 'react';
import networkConfig from '../config/network';

/**
 * Network Indicator Component
 * 
 * Displays the current network (Mainnet/Devnet) and warns if on wrong network.
 * Requirements: 23.3, 23.4
 */
const NetworkIndicator = () => {
  const [isMainnet, setIsMainnet] = useState(true);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Check if we're on mainnet
    const mainnet = networkConfig.isMainnet();
    setIsMainnet(mainnet);
    
    // Show warning if not on mainnet
    if (!mainnet) {
      setShowWarning(true);
      console.warn('⚠️ Not connected to Solana mainnet. Some features may not work correctly.');
    }
  }, []);

  const handleDismissWarning = () => {
    setShowWarning(false);
  };

  return (
    <>
      {/* Network Badge */}
      <div className="flex items-center">
        <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          isMainnet 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${
            isMainnet ? 'bg-green-500' : 'bg-yellow-500'
          }`}></span>
          {isMainnet ? 'Mainnet' : 'Devnet'}
        </div>
      </div>

      {/* Warning Banner */}
      {showWarning && !isMainnet && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <svg 
                className="w-5 h-5 mr-2" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                  clipRule="evenodd" 
                />
              </svg>
              <span className="font-medium">
                Warning: You are connected to {isMainnet ? 'Mainnet' : 'Devnet'}. 
                {!isMainnet && ' For production use, please connect to Mainnet.'}
              </span>
            </div>
            <button
              onClick={handleDismissWarning}
              className="text-yellow-900 hover:text-yellow-700 font-bold"
              aria-label="Dismiss warning"
            >
              <svg 
                className="w-5 h-5" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                  clipRule="evenodd" 
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkIndicator;
