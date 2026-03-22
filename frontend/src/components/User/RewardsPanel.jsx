// frontend/src/components/User/RewardsPanel.jsx - PROPER CLAIM FLOW

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatToken, formatSol } from '../../utils/format';
import networkConfig from '../../config/network';

const RewardsPanel = () => {
  const { loading, calculateRewards, wallet, claimRewards: claimFromContext, getClaimQuote: getQuoteFromWallet } = useWallet();
  const [rewards, setRewards] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [claimQuote, setClaimQuote] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Load rewards - memoized to prevent recreation
  const loadRewards = useCallback(async () => {
    try {
      console.log('🔄 Loading rewards...');
      const rewardsData = await calculateRewards();
      setRewards(rewardsData || []);
    } catch (error) {
      console.error('❌ Error loading rewards:', error);
      setError(error.message || 'Failed to load rewards');
    }
  }, [calculateRewards]); // Memoize with calculateRewards dependency

  // Get claim quote using WalletContext - memoized
  const getClaimQuote = useCallback(async () => {
    try {
      setError(null);
      console.log('📋 Getting claim quote...');

      const response = await getQuoteFromWallet();

      if (response.success) {
        setClaimQuote(response.data);
        setShowClaimModal(true);
      } else {
        setError(response.message);
      }
    } catch (error) {
      console.error('❌ Error getting claim quote:', error);
      setError(error.message || 'Failed to get claim quote');
    }
  }, [getQuoteFromWallet]); // Memoize with getQuoteFromWallet dependency

  // Create payment transaction for claim fees - memoized
  const createPaymentTransaction = useCallback(async (recipientWallet, amountSOL) => {
    try {
      console.log('💳 Creating payment transaction:', { recipientWallet, amountSOL });

      if (!wallet?.adapter?.publicKey) {
        throw new Error('Wallet not connected');
      }

      const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

      const transferInstruction = SystemProgram.transfer({
        fromPubkey: wallet.adapter.publicKey,
        toPubkey: new PublicKey(recipientWallet),
        lamports: lamports
      });

      const transaction = new Transaction().add(transferInstruction);

      const connection = new Connection(
        networkConfig.getRpcEndpoint(),
        'confirmed'
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.adapter.publicKey;

      console.log('🔐 Requesting signature from wallet...');
      const signedTransaction = await wallet.adapter.signTransaction(transaction);

      console.log('📡 Sending transaction to Solana...');
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      console.log('⏳ Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('✅ Payment transaction confirmed:', signature);
      return signature;

    } catch (error) {
      console.error('❌ Error creating payment transaction:', error);

      if (error.message.includes('insufficient')) {
        throw new Error('Insufficient SOL balance. Please add SOL to your wallet.');
      } else if (error.message.includes('User rejected')) {
        throw new Error('Transaction was cancelled by user.');
      } else {
        throw new Error('Failed to process payment: ' + error.message);
      }
    }
  }, [wallet]); // Memoize with wallet dependency

  // Execute claim with payment - memoized
  const executeClaimWithPayment = useCallback(async () => {
    try {
      setProcessing(true);
      setError(null);
      setEstimatedTime(45); // Estimated 45 seconds for claim transaction

      let paymentSignature = null;

      // Step 1: Pay claim fees if required
      if (claimQuote.requires_payment && claimQuote.total_claim_fee > 0) {
        setTransactionStatus('Processing claim fee payment...');
        console.log(`💳 Processing claim fee payment: ${claimQuote.total_claim_fee} SOL`);

        paymentSignature = await createPaymentTransaction(
          claimQuote.fee_recipient,
          claimQuote.total_claim_fee
        );

        console.log('✅ Claim fee payment completed:', paymentSignature);
      }

      // Step 2: Execute claim with payment proof
      setTransactionStatus('Processing reward claim...');
      console.log('🎯 Executing claim with payment proof...');

      const claimResult = await claimFromContext(paymentSignature);

      if (claimResult.success) {
        setTransactionStatus('Claim confirmed!');
        
        // Extract transaction signatures for Solscan links
        const signatures = [];
        if (paymentSignature) {
          signatures.push({
            type: 'Claim Fee Payment',
            signature: paymentSignature,
            amount: `${claimQuote.total_claim_fee} SOL`
          });
        }

        // Add reward transaction signatures if available
        if (claimResult.data?.successful_claims > 0) {
          signatures.push({
            type: 'Reward Distribution',
            signature: 'Check transactions tab for individual reward signatures',
            amount: `${claimResult.data.successful_claims} reward${claimResult.data.successful_claims !== 1 ? 's' : ''}`
          });
        }

        const successMessage = (
          <div>
            <p className="mb-2">
              Successfully claimed rewards! {
                paymentSignature
                  ? `Claim fee paid: ${claimQuote.total_claim_fee} SOL`
                  : 'No claim fee required.'
              }
            </p>
            {signatures.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="font-medium mb-1">Transaction Links:</p>
                {signatures.map((sig, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-gray-600">{sig.type}:</span>
                    {sig.signature.length === 88 ? (
                      <a
                        href={networkConfig.getTransactionUrl(sig.signature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        View on Explorer ({sig.signature.substring(0, 8)}...)
                      </a>
                    ) : (
                      <span className="ml-2 text-gray-500">{sig.signature}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

        setSuccess(successMessage);
        setShowClaimModal(false);
        setClaimQuote(null);

        // CRITICAL: Immediately set rewards to empty to show zero
        setRewards([]);

        // Reload rewards after a short delay
        setTimeout(() => {
          loadRewards();
        }, 2000); // Increased delay to ensure DB is updated
      } else {
        setError(claimResult.message || 'Failed to claim rewards');
      }

    } catch (error) {
      console.error('❌ Error claiming rewards:', error);

      const errorMessage = error.message || 'An error occurred while claiming rewards';
      setError(errorMessage);
      setTransactionStatus('');
    } finally {
      setProcessing(false);
      setTransactionStatus('');
      setEstimatedTime(0);
    }
  }, [claimQuote, createPaymentTransaction, claimFromContext, loadRewards]); // Memoize with dependencies

  // Load rewards on mount
  useEffect(() => {
    loadRewards();
    const interval = setInterval(loadRewards, 10000);
    return () => clearInterval(interval);
  }, [loadRewards]); // Add loadRewards as dependency

  // Clear messages - memoized
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []); // No dependencies

  // Memoize hasClaimableRewards calculation
  const hasClaimableRewards = React.useMemo(() => {
    return rewards && rewards.length > 0 && rewards.some(reward => reward.amount > 0);
  }, [rewards]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Your Rewards</h3>
        <button
          onClick={loadRewards}
          className="text-sm text-indigo-600 hover:text-indigo-500"
          title="Refresh rewards"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-medium mb-1">Claim Failed</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={clearMessages} className="ml-4 text-red-700 hover:text-red-900">
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {hasClaimableRewards && (
            <button
              onClick={getClaimQuote}
              className="mt-3 text-sm font-medium text-red-700 hover:text-red-900 underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 relative">
          <span className="block sm:inline">{success}</span>
          <button onClick={clearMessages} className="absolute top-0 bottom-0 right-0 px-4 py-3">
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {/* Current Rewards */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Available Rewards</h4>

            {rewards && rewards.length > 0 ? (
              <div className="space-y-3">
                {rewards.map((reward, index) => (
                  <div key={index} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-bold text-sm">
                          {reward.token_symbol?.charAt(0) || 'T'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {reward.token_symbol || 'Unknown Token'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {reward.token_address?.substring(0, 8)}...
                          {reward.token_address?.substring(reward.token_address.length - 4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {formatToken(reward.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reward.token_decimals} decimals
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-lg text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  No rewards available yet. Stake your NFTs to start earning rewards.
                </p>
              </div>
            )}
          </div>

          {/* Claim Button */}
          <button
            onClick={getClaimQuote}
            disabled={processing || !hasClaimableRewards}
            className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {processing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                <span>Processing...</span>
              </div>
            ) : hasClaimableRewards ? (
              `Claim All Rewards (${rewards.length} token${rewards.length !== 1 ? 's' : ''})`
            ) : (
              'No Rewards to Claim'
            )}
          </button>
        </>
      )}

      {/* Claim Modal */}
      {showClaimModal && claimQuote && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50"></div>

          <div className="relative bg-white rounded-lg max-w-md w-full mx-auto p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Reward Claim</h3>

            {processing ? (
              /* Loading State */
              <div className="mb-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
                  <p className="text-lg font-medium text-gray-900 mb-2">{transactionStatus}</p>
                  {estimatedTime > 0 && (
                    <p className="text-sm text-gray-500">
                      Estimated time: ~{estimatedTime} seconds
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-4 text-center">
                    Please do not close this window or refresh the page
                  </p>
                </div>
              </div>
            ) : (
              /* Confirmation State */
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-3">
                  You are about to claim {claimQuote.rewards.length} reward token{claimQuote.rewards.length !== 1 ? 's' : ''}.
                </p>

                {/* Rewards Summary */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <h4 className="text-sm font-medium text-green-800 mb-2">Rewards to Claim</h4>
                  <div className="text-xs text-green-700 space-y-1">
                    {claimQuote.rewards.map((reward, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{reward.token_symbol}:</span>
                        <span>{formatToken(reward.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Claim Fees */}
                {claimQuote.requires_payment && claimQuote.total_claim_fee > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">Claim Fees Required</h4>
                    <div className="text-xs text-yellow-700 space-y-1">
                      {claimQuote.collection_fees.map((fee, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{fee.collection_name}:</span>
                          <span>{formatSol(fee.claim_fee)} SOL</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-medium pt-1 border-t border-yellow-300">
                        <span>Total Fee:</span>
                        <span>{formatSol(claimQuote.total_claim_fee)} SOL</span>
                      </div>
                    </div>
                    <div className="text-xs mt-2 text-yellow-600">
                      You will be prompted to pay this fee to: {claimQuote.fee_recipient?.substring(0, 12)}...
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500">
                  {claimQuote.requires_payment
                    ? 'You will be prompted to approve the claim fee payment first, then rewards will be sent automatically.'
                    : 'No claim fees required. Rewards will be sent directly to your wallet.'
                  }
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowClaimModal(false);
                  setClaimQuote(null);
                }}
                disabled={processing}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                onClick={executeClaimWithPayment}
                disabled={processing}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    <span>Processing...</span>
                  </div>
                ) : claimQuote.requires_payment ? (
                  `Pay ${formatSol(claimQuote.total_claim_fee)} SOL & Claim`
                ) : (
                  'Claim Rewards'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Rewards update automatically every 10 seconds.</p>
        <p>Collection-specific claim fees apply when claiming rewards.</p>
      </div>
    </div>
  );
};

export default RewardsPanel;