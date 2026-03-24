// frontend/src/components/User/UnstakeModal.jsx
import React, { useState, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';

const UnstakeModal = ({ selectedNFTs, stakedNFTs, onSuccess, onClose }) => {
  const { unstakeNFTs } = useWallet();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const getNFTName = (id) => {
    const nft = stakedNFTs.find(n => n.id === id);
    return nft ? nft.name : `NFT #${id}`;
  };

  const handleConfirm = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      const result = await unstakeNFTs(selectedNFTs);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message || 'Failed to unstake');
      }
    } catch (e) {
      setError(e.message || 'An error occurred');
    } finally {
      setProcessing(false);
    }
  }, [selectedNFTs, unstakeNFTs, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={!processing ? onClose : undefined} />
      <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-green-400 mb-5">Confirm Unstaking</h3>

        {processing ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-red-500 mb-4" />
            <p className="text-green-300 font-medium">Processing unstake...</p>
            <p className="text-green-800 text-xs mt-3 text-center">Do not close this window</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
              <div className="text-xs text-green-600 uppercase tracking-widest mb-3">NFTs to Unstake</div>
              {selectedNFTs.map(id => (
                <div key={id} className="text-sm text-gray-400 py-1 border-b border-[#1e3a1e] last:border-0">
                  {getNFTName(id)}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mb-4">
              This will unstake {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''} from the platform. Your NFTs stay in your wallet.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black bg-red-500 hover:bg-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Unstake {selectedNFTs.length} NFTs
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UnstakeModal;
