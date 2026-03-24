// frontend/src/components/User/StakingPanel.jsx - FIXED VERSION

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatSol } from '../../utils/format';
import api from '../../services/api';
import networkConfig from '../../config/network';

const StakingPanel = ({
  selectedNFTs,
  setSelectedNFTs,
  onStakeSuccess,
  collections,
  walletNFTs
}) => {
  const { loading, wallet } = useWallet();
  const [totalFee, setTotalFee] = useState(0);
  const [feeRecipient, setFeeRecipient] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [nftsByCollection, setNftsByCollection] = useState({});
  const [transactionStatus, setTransactionStatus] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [transactionSignature, setTransactionSignature] = useState(null);

  // Calculate fees using the quote endpoint instead of admin settings
  const calculateFeesUsingQuote = useCallback(async () => {
    try {
      const grouped = {};

      selectedNFTs.forEach(mintAddress => {
        const nft = walletNFTs.find(n => n.mintAddress === mintAddress);
        if (nft && nft.collectionId) {
          const collection = collections.find(c => c.id === nft.collectionId);
          if (collection) {
            if (!grouped[collection.id]) {
              grouped[collection.id] = {
                collection,
                nfts: [],
                stakeFee: parseFloat(collection.stake_fee) || 0
              };
            }
            grouped[collection.id].nfts.push(nft);
          }
        }
      });

      setNftsByCollection(grouped);

      // Use the first collection to get the quote (all should be from same collection anyway)
      const firstCollectionId = Object.keys(grouped)[0];
      if (firstCollectionId) {
        const nftsForQuote = selectedNFTs.map(mintAddress => ({ mintAddress }));

        console.log('Getting stake quote for:', { nfts: nftsForQuote, collectionId: firstCollectionId });

        // Use the quote endpoint instead of admin settings
        const quoteResponse = await api.nft.getStakeQuote({
          nfts: nftsForQuote,
          collectionId: parseInt(firstCollectionId)
        });

        if (quoteResponse.data.success) {
          const quoteData = quoteResponse.data.data;
          setTotalFee(quoteData.totalFee);
          setFeeRecipient(quoteData.feeRecipient || '');

          console.log('Quote received:', quoteData);
        } else {
          throw new Error(quoteResponse.data.message || 'Failed to get quote');
        }
      }

    } catch (error) {
      console.error('Error getting stake quote:', error);
      setError('Failed to calculate staking fees: ' + error.message);
    }
  }, [selectedNFTs, walletNFTs, collections]); // Memoize with stable dependencies

  // Group selected NFTs by collection and calculate fees
  useEffect(() => {
    if (!selectedNFTs.length || !walletNFTs.length || !collections.length) {
      setTotalFee(0);
      setNftsByCollection({});
      setFeeRecipient('');
      return;
    }

    calculateFeesUsingQuote();
  }, [selectedNFTs, walletNFTs, collections, calculateFeesUsingQuote]);

  // Create payment transaction
  const createPaymentTransaction = useCallback(async (recipientWallet, amountSOL) => {
    try {
      console.log('Creating payment transaction:', { recipientWallet, amountSOL });

      if (!wallet?.adapter?.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Convert SOL to lamports
      const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: wallet.adapter.publicKey,
        toPubkey: new PublicKey(recipientWallet),
        lamports: lamports
      });

      // Create transaction
      const transaction = new Transaction().add(transferInstruction);

      // Get latest blockhash
      const connection = new Connection(
        networkConfig.getRpcEndpoint(),
        'confirmed' // Add commitment level
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.adapter.publicKey;

      // Sign and send transaction
      console.log('Requesting signature from wallet...');
      const signedTransaction = await wallet.adapter.signTransaction(transaction);

      console.log('Sending transaction to Solana...');
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      console.log('Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Payment transaction confirmed:', signature);
      return signature;

    } catch (error) {
      console.error('Error creating payment transaction:', error);

      // Provide more specific error messages
      if (error.message.includes('Attempt to debit an account but found no record of a prior credit')) {
        throw new Error('Insufficient SOL balance. Please add SOL to your wallet to cover the transaction fee and staking cost.');
      } else if (error.message.includes('Simulation failed')) {
        throw new Error('Transaction simulation failed. Please check your wallet balance and try again.');
      } else if (error.message.includes('User rejected')) {
        throw new Error('Transaction was cancelled by user.');
      } else {
        throw new Error('Failed to process payment: ' + error.message);
      }
    }
  }, [wallet]); // Memoize with wallet dependency

  // Handle stake button
  const handleStake = useCallback(() => {
    if (selectedNFTs.length === 0) {
      setError('Please select at least one NFT to stake');
      return;
    }

    setShowConfirm(true);
  }, [selectedNFTs.length]); // Memoize with stable dependency

  // Handle confirm stake
  const handleConfirmStake = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      setTransactionSignature(null);
      setEstimatedTime(30); // Estimated 30 seconds for transaction

      let paymentSignature = null;

      // Step 1: Create payment transaction if there's a fee
      if (totalFee > 0 && feeRecipient) {
        setTransactionStatus('Preparing payment transaction...');
        console.log(`Processing payment of ${totalFee} SOL to ${feeRecipient}`);
        
        paymentSignature = await createPaymentTransaction(feeRecipient, totalFee);
        setTransactionSignature(paymentSignature);
        console.log('Payment completed:', paymentSignature);
      }

      // Step 2: Execute staking with payment proof
      setTransactionStatus('Processing stake transaction...');
      const nftsForStaking = selectedNFTs.map(mintAddress => ({
        mintAddress,
        traits: [] // You might want to get actual traits from NFT metadata
      }));

      // Get the collection ID from the first NFT (assuming all selected NFTs are from same collection)
      const firstNFT = walletNFTs.find(nft => nft.mintAddress === selectedNFTs[0]);
      const collectionId = firstNFT?.collectionId;

      if (!collectionId) {
        throw new Error('Could not determine collection ID');
      }

      console.log('Executing stake with data:', {
        nfts: nftsForStaking,
        collectionId,
        paymentSignature,
        nftsLength: nftsForStaking.length,
        firstNFT: nftsForStaking[0]
      });

      // Call the staking API with payment signature
      const result = await api.nft.stakeNFTs(nftsForStaking, collectionId, paymentSignature);

      if (result.data.success) {
        setTransactionStatus('Transaction confirmed!');
        
        // Create success message with transaction link
        const successMessage = paymentSignature ? (
          <div>
            <p className="mb-2">Successfully staked {selectedNFTs.length} NFTs!</p>
            <a
              href={networkConfig.getTransactionUrl(paymentSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View transaction on Solana Explorer
            </a>
          </div>
        ) : (
          `Successfully staked ${selectedNFTs.length} NFTs!`
        );
        
        setSuccess(successMessage);
        setSelectedNFTs([]);
        setShowConfirm(false);

        if (onStakeSuccess) {
          onStakeSuccess();
        }
      } else {
        setError(result.data.message || 'Failed to stake NFTs');
      }

    } catch (error) {
      console.error('❌ Error staking NFTs:', error);

      // Debug: Log the full error response
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }

      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage || 'An error occurred while staking NFTs');
      setTransactionStatus('');
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setProcessing(false);
      setTransactionStatus('');
      setEstimatedTime(0);
    }
  }, [selectedNFTs, walletNFTs, totalFee, feeRecipient, createPaymentTransaction, onStakeSuccess]); // Memoize with dependencies

  // Handle cancel
  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []); // No dependencies

  // Clear messages
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []); // No dependencies

  // Get NFT name by mint address - memoize to prevent recreation
  const getNFTName = useCallback((mintAddress) => {
    const nft = walletNFTs.find(n => n.mintAddress === mintAddress);
    return nft ? nft.name : `${mintAddress.substr(0, 6)}...${mintAddress.substr(-4)}`;
  }, [walletNFTs]); // Memoize with walletNFTs dependency

  return (
    <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.1)] p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">🐸</span>
        <h3 className="text-lg font-semibold text-green-400 tracking-wide">Staking</h3>
      </div>

      {error && (
        <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-semibold mb-1 text-red-300">Transaction Failed</p>
              <p className="text-sm">{error}</p>
              {transactionSignature && (
                <a
                  href={networkConfig.getTransactionUrl(transactionSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-red-400 hover:text-red-300 underline mt-2 inline-block"
                >
                  View failed transaction
                </a>
              )}
            </div>
            <button onClick={clearMessages} className="ml-4 text-red-500 hover:text-red-300 transition-colors">
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {!showConfirm && selectedNFTs.length > 0 && (
            <button onClick={handleStake} className="mt-3 text-sm font-medium text-red-400 hover:text-red-300 underline">
              Try again
            </button>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-950/60 border border-green-700 text-green-400 px-4 py-3 rounded-xl mb-4 relative">
          <span className="block sm:inline">{success}</span>
          <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-green-500 hover:text-green-300">
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Selected NFTs */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-widest">Selected NFTs</span>
          <span className="text-xs text-green-700 bg-green-950/50 border border-green-800 px-2 py-0.5 rounded-full">
            {selectedNFTs.length} selected
          </span>
        </div>
        <div className="p-3 border border-[#1e3a1e] rounded-xl bg-[#0d1a0d] min-h-[100px] max-h-[200px] overflow-y-auto">
          {selectedNFTs.length > 0 ? (
            <div className="space-y-1">
              {selectedNFTs.map((mintAddress) => (
                <div
                  key={mintAddress}
                  className="flex justify-between items-center px-3 py-1.5 bg-[#111a11] border border-[#1e3a1e] rounded-lg text-xs hover:border-green-700 transition-colors"
                >
                  <span className="font-medium text-green-300 truncate">
                    {getNFTName(mintAddress)}
                  </span>
                  <span className="text-green-700 ml-2 font-mono">
                    {mintAddress.substr(0, 4)}...{mintAddress.substr(-4)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[80px]">
              <p className="text-sm text-green-800">No NFTs selected</p>
            </div>
          )}
        </div>
      </div>

      {/* Fee Breakdown */}
      {Object.keys(nftsByCollection).length > 0 && (
        <div className="mb-5 bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4">
          <h4 className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-3">Fee Breakdown</h4>
          <div className="space-y-2">
            {Object.values(nftsByCollection).map((group) => (
              <div key={group.collection.id} className="flex justify-between items-center text-sm">
                <span className="text-gray-400">
                  {group.collection.name} ({group.nfts.length} NFT{group.nfts.length !== 1 ? 's' : ''})
                </span>
                <span className="font-medium text-green-400">
                  {formatSol(group.stakeFee * group.nfts.length)} SOL
                </span>
              </div>
            ))}
            <div className="border-t border-[#1e3a1e] pt-2 mt-2 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-300">Total Fee</span>
              <span className="text-sm font-bold text-green-300">{formatSol(totalFee)} SOL</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleStake}
        disabled={loading || selectedNFTs.length === 0 || processing}
        className="w-full py-3 px-4 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] disabled:bg-green-900 disabled:text-green-700 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {processing ? 'Processing...' : `Stake ${selectedNFTs.length} NFTs${totalFee > 0 ? ` (${formatSol(totalFee)} SOL)` : ''}`}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm"></div>

          <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-md w-full mx-auto p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">🐸</span>
              <h3 className="text-lg font-semibold text-green-400">Confirm Staking</h3>
            </div>

            {processing ? (
              <div className="mb-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500 mb-4"></div>
                  <p className="text-lg font-medium text-green-300 mb-2">{transactionStatus}</p>
                  {estimatedTime > 0 && (
                    <p className="text-sm text-green-700">Estimated time: ~{estimatedTime} seconds</p>
                  )}
                  <p className="text-xs text-green-800 mt-4 text-center">
                    Please do not close this window or refresh the page
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <p className="text-sm text-gray-400 mb-4">
                  You are about to stake {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? 's' : ''}.
                </p>

                {totalFee > 0 && (
                  <div className="bg-[#0d1a0d] border border-green-800 rounded-xl p-4 mb-4">
                    <h4 className="text-xs font-semibold text-green-500 uppercase tracking-widest mb-3">Payment Required</h4>
                    <div className="text-xs text-gray-400 space-y-2">
                      {Object.values(nftsByCollection).map((group) => (
                        <div key={group.collection.id} className="flex justify-between">
                          <span>{group.collection.name}:</span>
                          <span className="text-green-400">{formatSol(group.stakeFee * group.nfts.length)} SOL</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold pt-2 border-t border-[#1e3a1e] text-green-300">
                        <span>Total Fee:</span>
                        <span>{formatSol(totalFee)} SOL</span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500">
                  {totalFee > 0
                    ? 'You will be prompted to approve the payment transaction first, then staking completes automatically.'
                    : 'This operation is free. Ready to stake?'
                  }
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                disabled={processing}
                className="py-2 px-5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmStake}
                disabled={processing}
                className="py-2 px-5 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:bg-green-900 disabled:text-green-700 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black mr-2"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  `Confirm Staking${totalFee > 0 ? ` (${formatSol(totalFee)} SOL)` : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakingPanel;