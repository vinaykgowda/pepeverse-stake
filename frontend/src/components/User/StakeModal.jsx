// frontend/src/components/User/StakeModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatSol } from '../../utils/format';
import api from '../../services/api';

const StakeModal = ({ selectedNFTs, walletNFTs, collections, onSuccess, onClose }) => {
  const { wallet } = useWallet();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  // Group NFTs by collection for display
  const nftsByCollection = React.useMemo(() => {
    const grouped = {};
    selectedNFTs.forEach(mintAddress => {
      const nft = walletNFTs.find(n => n.mintAddress === mintAddress);
      if (nft?.collectionId) {
        const col = collections.find(c => c.id === nft.collectionId);
        if (col) {
          if (!grouped[col.id]) grouped[col.id] = { collection: col, nfts: [], stakeFee: parseFloat(col.stake_fee) || 0 };
          grouped[col.id].nfts.push(nft);
        }
      }
    });
    return grouped;
  }, [selectedNFTs, walletNFTs, collections]);

  // Fetch quote on mount
  useEffect(() => {
    const fetchQuote = async () => {
      const firstCollectionId = Object.keys(nftsByCollection)[0];
      if (!firstCollectionId) { setLoading(false); return; }
      try {
        const res = await api.nft.getStakeQuote({
          nfts: selectedNFTs.map(m => ({ mintAddress: m })),
          collectionId: parseInt(firstCollectionId),
        });
        if (res.data.success) setQuote(res.data.data);
        else setError(res.data.message || 'Failed to get quote');
      } catch (e) {
        setError(e.message || 'Failed to get quote');
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      let paymentSignature = null;

      if (quote?.totalFee > 0 && quote?.feeRecipient) {
        setStatus('Preparing payment...');
        const lamports = Math.floor(quote.totalFee * LAMPORTS_PER_SOL);

        // Get blockhash via backend proxy (avoids 403 on public RPC)
        const blockhashRes = await api.solana.getBlockhash();
        const { blockhash } = blockhashRes.data.data;

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.adapter.publicKey,
            toPubkey: new PublicKey(quote.feeRecipient),
            lamports,
          })
        );
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.adapter.publicKey;
        const signed = await wallet.adapter.signTransaction(tx);

        // Send via backend proxy
        const sendRes = await api.solana.sendTransaction(
          Buffer.from(signed.serialize()).toString('base64')
        );
        paymentSignature = sendRes.data.data.signature;
      }

      setStatus('Staking NFTs...');
      const firstNFT = walletNFTs.find(n => n.mintAddress === selectedNFTs[0]);
      const collectionId = firstNFT?.collectionId;
      if (!collectionId) throw new Error('Could not determine collection');

      const nftsPayload = selectedNFTs.map(m => ({ mintAddress: m, traits: [] }));
      const result = await api.nft.stakeNFTs(nftsPayload, collectionId, paymentSignature);

      if (result.data.success) {
        onSuccess();
      } else {
        setError(result.data.message || 'Staking failed');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'An error occurred');
    } finally {
      setProcessing(false);
      setStatus('');
    }
  }, [quote, wallet, selectedNFTs, walletNFTs, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={!processing ? onClose : undefined} />
      <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-green-400 mb-5">Confirm Staking</h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500" />
          </div>
        ) : processing ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-green-500 mb-4" />
            <p className="text-green-300 font-medium">{status}</p>
            <p className="text-green-800 text-xs mt-3 text-center">Do not close this window</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            {/* NFT summary */}
            <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 mb-4">
              <div className="text-xs text-green-600 uppercase tracking-widest mb-3">Staking Summary</div>
              {Object.values(nftsByCollection).map(group => (
                <div key={group.collection.id} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">{group.collection.name} × {group.nfts.length}</span>
                  <span className="text-green-400">{formatSol(group.stakeFee * group.nfts.length)} SOL</span>
                </div>
              ))}
              <div className="border-t border-[#1e3a1e] pt-2 mt-2 flex justify-between">
                <span className="text-sm font-medium text-gray-300">Total NFTs</span>
                <span className="text-sm font-bold text-green-300">{selectedNFTs.length}</span>
              </div>
              {quote && (
                <div className="flex justify-between mt-1">
                  <span className="text-sm font-medium text-gray-300">Total Fee</span>
                  <span className="text-sm font-bold text-green-300">{formatSol(quote.totalFee)} SOL</span>
                </div>
              )}
            </div>

            {quote?.totalFee > 0 && (
              <p className="text-xs text-gray-500 mb-4">
                You will be prompted to approve a payment of {formatSol(quote.totalFee)} SOL before staking.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!!error}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:bg-green-900 disabled:text-green-700 disabled:shadow-none"
              >
                {quote?.totalFee > 0 ? `Pay ${formatSol(quote.totalFee)} SOL & Stake` : `Stake ${selectedNFTs.length} NFTs`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StakeModal;
