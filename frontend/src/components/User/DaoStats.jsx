// frontend/src/components/User/DaoStats.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../context/WalletContext';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatToken, formatSol } from '../../utils/format';
import api from '../../services/api';

const DaoStats = ({ walletAddress, onEarningsChange }) => {
  const { wallet } = useWallet();

  // DAO rewards state
  const [daoRewards, setDaoRewards] = useState([]);
  const [daoDailyRates, setDaoDailyRates] = useState({});
  const [loadingRewards, setLoadingRewards] = useState(false);

  // DAO claim state
  const [daoClaimQuote, setDaoClaimQuote] = useState(null);
  const [showDaoClaimModal, setShowDaoClaimModal] = useState(false);
  const [daoClaimProcessing, setDaoClaimProcessing] = useState(false);
  const [daoClaimStatus, setDaoClaimStatus] = useState('');
  const [daoClaimError, setDaoClaimError] = useState(null);
  const [daoClaimSuccess, setDaoClaimSuccess] = useState(null);

  // DAO airdrop state
  const [daoAirdrops, setDaoAirdrops] = useState([]);
  const [daoAirdropQuote, setDaoAirdropQuote] = useState(null);
  const [showDaoAirdropModal, setShowDaoAirdropModal] = useState(false);
  const [daoAirdropProcessing, setDaoAirdropProcessing] = useState(false);
  const [daoAirdropError, setDaoAirdropError] = useState(null);
  const [daoAirdropSuccess, setDaoAirdropSuccess] = useState(null);

  const loadingRef = useRef(false);

  const loadDaoData = useCallback(async () => {
    if (!walletAddress || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingRewards(true);
    try {
      const [rewardsRes, airdropsRes] = await Promise.all([
        api.daoUser.getRewards(walletAddress).catch(() => null),
        api.daoUser.getAirdrops(walletAddress).catch(() => null),
      ]);

      const rewards = rewardsRes?.data?.data || [];
      setDaoRewards(rewards);
      if (onEarningsChange) {
        onEarningsChange(rewards.some(r => parseFloat(r.amount) > 0));
      }

      // Build daily rates map from rewards (token_symbol → daily_rate if provided)
      const rates = {};
      rewards.forEach(r => {
        if (r.daily_rate != null) {
          rates[r.token_symbol] = (rates[r.token_symbol] || 0) + r.daily_rate;
        }
      });
      setDaoDailyRates(rates);

      setDaoAirdrops(airdropsRes?.data?.data || []);
    } catch (e) {
      console.error('Error loading DAO data:', e);
    } finally {
      setLoadingRewards(false);
      loadingRef.current = false;
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      loadDaoData();
    }
  }, [walletAddress, loadDaoData]);

  // Payment helper — signs locally, sends via backend proxy
  const createPaymentTx = useCallback(async (recipient, amountSOL) => {
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    const blockhashRes = await api.solana.getBlockhash();
    const { blockhash } = blockhashRes.data.data;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.adapter.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports,
      })
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.adapter.publicKey;

    const signed = await wallet.adapter.signTransaction(tx);
    const serialized = signed.serialize();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(serialized)));
    const sendRes = await api.solana.sendTransaction(base64);
    return sendRes.data.data.signature;
  }, [wallet]);

  // DAO Claim flow
  const handleDaoClaimClick = useCallback(async () => {
    setDaoClaimError(null);
    try {
      const res = await api.daoUser.getClaimQuote(walletAddress);
      const data = res.data?.data || res.data || {};
      setDaoClaimQuote({
        rewards: daoRewards,
        total_claim_fee: data.claimFee ?? data.claim_fee ?? 0,
        fee_recipient: data.feeRecipient ?? data.fee_recipient ?? null,
        requires_payment: data.requiresPayment ?? data.requires_payment ?? false,
      });
      setShowDaoClaimModal(true);
    } catch (e) {
      setDaoClaimError(e.response?.data?.message || e.message || 'Failed to get claim quote');
    }
  }, [walletAddress, daoRewards]);

  const executeDaoClaimWithPayment = useCallback(async () => {
    setDaoClaimProcessing(true);
    setDaoClaimError(null);
    try {
      let paymentSignature = null;
      if (daoClaimQuote.requires_payment && daoClaimQuote.total_claim_fee > 0) {
        setDaoClaimStatus('Processing DAO claim fee payment...');
        paymentSignature = await createPaymentTx(daoClaimQuote.fee_recipient, daoClaimQuote.total_claim_fee);
      }
      setDaoClaimStatus('Claiming DAO rewards...');
      const res = await api.daoUser.claimRewards({
        wallet_address: walletAddress,
        payment_signature: paymentSignature,
      });
      if (res.data?.success) {
        setDaoClaimSuccess('DAO rewards claimed successfully!');
        setShowDaoClaimModal(false);
        setDaoClaimQuote(null);
        setDaoRewards([]);
        setTimeout(loadDaoData, 2000);
      } else {
        setDaoClaimError(res.data?.message || 'Failed to claim DAO rewards');
      }
    } catch (e) {
      setDaoClaimError(e.response?.data?.message || e.message || 'An error occurred');
    } finally {
      setDaoClaimProcessing(false);
      setDaoClaimStatus('');
    }
  }, [daoClaimQuote, walletAddress, createPaymentTx, loadDaoData]);

  // DAO Airdrop flow
  const handleDaoAirdropClaim = useCallback(async (airdrop) => {
    setDaoAirdropError(null);
    setDaoAirdropSuccess(null);
    try {
      const res = await api.daoUser.getAirdropQuote({
        wallet_address: walletAddress,
        dao_airdrop_config_id: airdrop.dao_airdrop_config_id,
      });
      setDaoAirdropQuote({ ...res.data?.data, airdrop });
      setShowDaoAirdropModal(true);
    } catch (e) {
      setDaoAirdropError(e.response?.data?.message || 'Failed to get DAO airdrop quote');
    }
  }, [walletAddress]);

  const executeDaoAirdropClaim = useCallback(async () => {
    if (!daoAirdropQuote) return;
    setDaoAirdropProcessing(true);
    setDaoAirdropError(null);
    try {
      let paymentSignature = null;
      if (daoAirdropQuote.claim_fee > 0 && daoAirdropQuote.fee_recipient) {
        paymentSignature = await createPaymentTx(daoAirdropQuote.fee_recipient, daoAirdropQuote.claim_fee);
      }
      const res = await api.daoUser.claimAirdrop({
        wallet_address: walletAddress,
        dao_airdrop_config_id: daoAirdropQuote.airdrop.dao_airdrop_config_id,
        payment_signature: paymentSignature,
      });
      setDaoAirdropSuccess({
        signature: res.data?.signature,
        tokenSymbol: daoAirdropQuote.airdrop.token_symbol,
        tokenAmount: daoAirdropQuote.token_amount,
      });
      setShowDaoAirdropModal(false);
      setDaoAirdropQuote(null);
      setDaoAirdrops(prev =>
        prev.filter(a => a.dao_airdrop_config_id !== daoAirdropQuote.airdrop.dao_airdrop_config_id)
      );
    } catch (e) {
      const s = e.response?.status;
      if (s === 409) setDaoAirdropError('Already claimed.');
      else if (s === 410) setDaoAirdropError('Claim window expired.');
      else setDaoAirdropError(e.response?.data?.message || 'Failed to claim DAO airdrop.');
    } finally {
      setDaoAirdropProcessing(false);
    }
  }, [daoAirdropQuote, walletAddress, createPaymentTx]);

  const formatCountdown = (seconds) => {
    if (seconds === null || seconds === undefined) return 'No expiry';
    if (seconds <= 0) return 'Expired';
    const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const hasClaimableRewards = daoRewards.some(r => r.amount > 0);

  return (
    <div className="bg-[#0d1220] border border-[#1e2a4a] rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.1)] p-4 flex flex-col justify-between">

      {/* DAO Claim success banner */}
      {daoClaimSuccess && (
        <div className="bg-blue-950/60 border border-blue-700 text-blue-300 px-4 py-3 rounded-xl mb-4 text-sm flex justify-between">
          <span>{daoClaimSuccess}</span>
          <button onClick={() => setDaoClaimSuccess(null)} className="text-blue-500 hover:text-blue-300 ml-4">✕</button>
        </div>
      )}

      {/* DAO Earning section */}
      <div>
        <div className="text-xs text-blue-500 uppercase tracking-widest mb-3">DAO Earning</div>

        {loadingRewards ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500" />
          </div>
        ) : daoRewards.length === 0 ? (
          <div className="text-sm text-blue-900 py-2">No DAO rewards yet</div>
        ) : (
          <div className="space-y-2">
            {daoRewards.map((r, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <span className="text-sm text-gray-400">{r.token_symbol}</span>
                  {daoDailyRates[r.token_symbol] > 0 && (
                    <span className="ml-2 text-xs text-blue-800">
                      {daoDailyRates[r.token_symbol] % 1 === 0
                        ? daoDailyRates[r.token_symbol]
                        : daoDailyRates[r.token_symbol].toFixed(2)}/day
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold text-blue-400">{formatToken(r.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {daoClaimError && !showDaoClaimModal && (
          <div className="bg-red-950/60 border border-red-700 text-red-400 px-3 py-2 rounded-xl mt-3 text-sm flex justify-between">
            <span>{daoClaimError}</span>
            <button onClick={() => setDaoClaimError(null)} className="ml-2">✕</button>
          </div>
        )}
      </div>

      {/* Claim DAO Rewards button */}
      <button
        onClick={handleDaoClaimClick}
        disabled={!hasClaimableRewards || daoClaimProcessing}
        className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:bg-blue-950 disabled:text-blue-800 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {daoClaimProcessing ? 'Processing...' : 'Claim DAO Rewards'}
      </button>

      {/* DAO Airdrops section */}
      {(daoAirdrops.length > 0 || daoAirdropError) && (
        <div className="border-t border-[#1e2a4a] pt-5 mt-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">🔵 DAO Airdrops</span>
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full animate-pulse">{daoAirdrops.length}</span>
          </div>
          {daoAirdropError && (
            <div className="bg-red-950/60 border border-red-700 text-red-400 px-3 py-2 rounded-xl mb-3 text-sm flex justify-between">
              <span>{daoAirdropError}</span>
              <button onClick={() => setDaoAirdropError(null)} className="ml-2">✕</button>
            </div>
          )}
          <div className="space-y-3">
            {daoAirdrops.map(airdrop => {
              const expired = airdrop.time_remaining_seconds <= 0;
              return (
                <div
                  key={airdrop.dao_airdrop_config_id}
                  className="dao-breathe rounded-xl p-4 flex justify-between items-center"
                  style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e40af, #3b82f6)' }}
                >
                  <div>
                    <div className="text-sm font-bold text-blue-200">
                      {airdrop.collection_name ? `${airdrop.collection_name} — ` : ''}{airdrop.token_symbol}
                    </div>
                    <div className="text-base font-extrabold text-white mt-0.5">
                      {parseFloat(airdrop.token_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                      <span className="text-blue-300">{airdrop.token_symbol}</span>
                    </div>
                    <div className={`text-xs mt-1 font-medium ${expired ? 'text-red-400' : 'text-blue-300'}`}>
                      ⏱ {formatCountdown(airdrop.time_remaining_seconds)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDaoAirdropClaim(airdrop)}
                    disabled={expired || daoAirdropProcessing}
                    className="px-5 py-2.5 rounded-xl text-sm font-extrabold text-white bg-blue-500 hover:bg-blue-400 transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {expired ? 'Expired' : 'Claim'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAO Claim Rewards Modal */}
      {showDaoClaimModal && daoClaimQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={!daoClaimProcessing ? () => { setShowDaoClaimModal(false); setDaoClaimQuote(null); } : undefined}
          />
          <div className="relative bg-[#0d1220] border border-[#1e2a4a] rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.2)] max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-5">Confirm DAO Reward Claim</h3>
            {daoClaimProcessing ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blue-500 mb-4" />
                <p className="text-blue-300 font-medium">{daoClaimStatus}</p>
                <p className="text-blue-800 text-xs mt-3 text-center">Do not close this window</p>
              </div>
            ) : (
              <>
                {daoClaimError && (
                  <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    {daoClaimError}
                  </div>
                )}
                <div className="bg-[#0a0f1e] border border-[#1e2a4a] rounded-xl p-4 mb-4">
                  <div className="text-xs text-blue-600 uppercase tracking-widest mb-3">DAO Rewards to Claim</div>
                  {daoClaimQuote.rewards?.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{r.token_symbol}</span>
                      <span className="text-blue-400">{formatToken(r.amount)}</span>
                    </div>
                  ))}
                  {daoClaimQuote.total_claim_fee > 0 && (
                    <div className="border-t border-[#1e2a4a] pt-2 mt-2 flex justify-between text-sm">
                      <span className="text-gray-400">Claim Fee</span>
                      <span className="text-yellow-400">{formatSol(daoClaimQuote.total_claim_fee)} SOL</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDaoClaimModal(false); setDaoClaimQuote(null); }}
                    className="flex-1 py-2.5 border border-[#1e2a4a] rounded-xl text-sm font-medium text-gray-400 bg-[#0a0f1e] hover:border-blue-700 hover:text-blue-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDaoClaimWithPayment}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  >
                    {daoClaimQuote.total_claim_fee > 0
                      ? `Pay ${formatSol(daoClaimQuote.total_claim_fee)} SOL & Claim`
                      : 'Claim DAO Rewards'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DAO Airdrop Claim Modal */}
      {showDaoAirdropModal && daoAirdropQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={!daoAirdropProcessing ? () => { setShowDaoAirdropModal(false); setDaoAirdropQuote(null); } : undefined}
          />
          <div className="relative bg-[#0d1220] border border-[#1e2a4a] rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.3)] max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-5">🔵 Confirm DAO Airdrop Claim</h3>
            {daoAirdropProcessing ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mb-4" />
                <p className="text-blue-300 text-sm">Sending your DAO airdrop...</p>
              </div>
            ) : (
              <>
                {daoAirdropError && (
                  <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    {daoAirdropError}
                  </div>
                )}
                <div className="bg-[#0a0f1e] border border-[#1e2a4a] rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">You receive</span>
                    <span className="text-white font-extrabold text-base">
                      {parseFloat(daoAirdropQuote.token_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      <span className="text-blue-400 ml-1">{daoAirdropQuote.airdrop.token_symbol}</span>
                    </span>
                  </div>
                  {daoAirdropQuote.claim_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Claim fee</span>
                      <span className="text-yellow-400">{formatSol(daoAirdropQuote.claim_fee)} SOL</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDaoAirdropModal(false); setDaoAirdropQuote(null); }}
                    className="flex-1 py-2.5 border border-[#1e2a4a] rounded-xl text-sm font-medium text-blue-700 bg-[#0a0f1e] hover:border-blue-600 hover:text-blue-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDaoAirdropClaim}
                    className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  >
                    {daoAirdropQuote.claim_fee > 0 ? 'Pay & Claim' : 'Claim DAO Airdrop'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DAO Airdrop Success Popup */}
      {daoAirdropSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDaoAirdropSuccess(null)} />
          <div className="relative bg-[#0d1220] border border-blue-600 rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.4)] max-w-sm w-full mx-4 p-6 text-center">
            <div className="text-5xl mb-3">🔵</div>
            <h3 className="text-xl font-extrabold text-blue-400 mb-1">DAO Airdrop Claimed!</h3>
            <p className="text-white font-bold text-2xl mb-1">
              {parseFloat(daoAirdropSuccess.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              <span className="text-blue-400 ml-2">{daoAirdropSuccess.tokenSymbol}</span>
            </p>
            <p className="text-blue-700 text-xs mb-5">sent to your wallet</p>
            <button
              onClick={() => setDaoAirdropSuccess(null)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaoStats;
