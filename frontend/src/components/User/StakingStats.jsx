// frontend/src/components/User/StakingStats.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../../context/WalletContext';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatToken, formatSol } from '../../utils/format';
import api from '../../services/api';

const StakingStats = ({ walletNFTs = [] }) => {
  const { loading, getStakingStats, getStakedNFTs, calculateRewards, claimRewards, getClaimQuote, wallet, connected } = useWallet();

  const [stats, setStats] = useState({ totalStaked: 0, stakedByCollection: [], totalRewards: 0 });
  const [rewards, setRewards] = useState([]);
  const [globalStats, setGlobalStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Claim state
  const [claimQuote, setClaimQuote] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimProcessing, setClaimProcessing] = useState(false);
  const [claimStatus, setClaimStatus] = useState('');
  const [claimError, setClaimError] = useState(null);
  const [claimSuccess, setClaimSuccess] = useState(null);

  // Airdrop state
  const [airdrops, setAirdrops] = useState([]);
  const [airdropQuote, setAirdropQuote] = useState(null);
  const [showAirdropModal, setShowAirdropModal] = useState(false);
  const [airdropProcessing, setAirdropProcessing] = useState(false);
  const [airdropError, setAirdropError] = useState(null);
  const [airdropSuccess, setAirdropSuccess] = useState(null);

  const loadingRef = useRef(false);

  const loadStats = useCallback(async () => {
    if (!connected || loadingRef.current) return;
    try {
      loadingRef.current = true;
      setLoadingStats(true);
      const [statsData, stakedNFTs, rewardsData, globalData] = await Promise.all([
        getStakingStats(),
        getStakedNFTs(),
        calculateRewards(),
        api.staking.getGlobalStats().then(r => r.data.data).catch(() => []),
      ]);
      const rewardsList = rewardsData || [];
      const totalRewards = rewardsList.reduce((t, r) => t + (r.amount || 0), 0);
      setStats({ totalStaked: stakedNFTs?.length || 0, stakedByCollection: statsData || [], totalRewards });
      setRewards(rewardsList);
      setGlobalStats(globalData || []);
      setStatsLoaded(true);
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoadingStats(false);
      loadingRef.current = false;
    }
  }, [connected, getStakingStats, getStakedNFTs, calculateRewards]);

  const loadAirdrops = useCallback(async () => {
    if (!wallet?.adapter?.publicKey) return;
    try {
      const res = await api.user.getAirdrops(wallet.adapter.publicKey.toString());
      setAirdrops(res.data.data || []);
    } catch (e) { /* non-critical */ }
  }, [wallet]);

  useEffect(() => {
    if (connected && !statsLoaded && !loadingRef.current) {
      loadStats();
      loadAirdrops();
    }
    if (!connected) {
      setStats({ totalStaked: 0, stakedByCollection: [], totalRewards: 0 });
      setRewards([]);
      setGlobalStats([]);
      setStatsLoaded(false);
    }
  }, [connected, statsLoaded, loadStats, loadAirdrops]);

  // Payment helper — signs locally, sends via backend proxy (keeps Helius API key server-side)
  const createPaymentTx = useCallback(async (recipient, amountSOL) => {
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    // Get blockhash via backend proxy (Helius, key stays server-side)
    const blockhashRes = await api.solana.getBlockhash();
    const { blockhash, lastValidBlockHeight } = blockhashRes.data.data;

    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet.adapter.publicKey, toPubkey: new PublicKey(recipient), lamports })
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.adapter.publicKey;

    // Wallet signs locally — no RPC involved here
    const signed = await wallet.adapter.signTransaction(tx);

    // Send serialized tx via backend proxy
    const serialized = signed.serialize();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(serialized)));
    const sendRes = await api.solana.sendTransaction(base64);
    return sendRes.data.data.signature;
  }, [wallet]);

  // Claim flow
  const handleClaimClick = useCallback(async () => {
    setClaimError(null);
    try {
      const res = await getClaimQuote();
      if (res.success) {
        const treasuryWarning = res.data.treasury_warning ?? null;
        setClaimQuote({
          rewards: rewards,
          total_claim_fee: res.data.claimFee ?? res.data.total_claim_fee ?? 0,
          fee_recipient: res.data.feeRecipient ?? res.data.fee_recipient ?? null,
          requires_payment: res.data.requiresPayment ?? res.data.requires_payment ?? false,
          treasury_warning: treasuryWarning,
        });
        setShowClaimModal(true);
      } else {
        setClaimError(res.message);
      }
    } catch (e) { setClaimError(e.message); }
  }, [getClaimQuote, rewards]);

  const executeClaimWithPayment = useCallback(async () => {
    try {
      setClaimProcessing(true);
      setClaimError(null);
      let paymentSignature = null;
      if (claimQuote.requires_payment && claimQuote.total_claim_fee > 0) {
        setClaimStatus('Processing claim fee payment...');
        paymentSignature = await createPaymentTx(claimQuote.fee_recipient, claimQuote.total_claim_fee);
      }
      setClaimStatus('Claiming rewards...');
      const result = await claimRewards(paymentSignature);
      if (result.success) {
        setClaimSuccess('Rewards claimed successfully!');
        setShowClaimModal(false);
        setClaimQuote(null);
        setRewards([]);
        setStats(s => ({ ...s, totalRewards: 0 }));
        setTimeout(loadStats, 2000);
      } else {
        setClaimError(result.message || 'Failed to claim');
      }
    } catch (e) {
      setClaimError(e.message || 'An error occurred');
    } finally {
      setClaimProcessing(false);
      setClaimStatus('');
    }
  }, [claimQuote, createPaymentTx, claimRewards, loadStats]);

  // Airdrop flow
  const handleAirdropClaim = useCallback(async (airdrop) => {
    if (!wallet?.adapter?.publicKey) return;
    setAirdropError(null);
    setAirdropSuccess(null);
    try {
      const res = await api.user.getAirdropQuote({
        wallet_address: wallet.adapter.publicKey.toString(),
        airdrop_config_id: airdrop.airdrop_config_id,
      });
      setAirdropQuote({ ...res.data.data, airdrop });
      setShowAirdropModal(true);
    } catch (e) { setAirdropError(e.response?.data?.message || 'Failed to get airdrop quote'); }
  }, [wallet]);

  const executeAirdropClaim = useCallback(async () => {
    if (!airdropQuote || !wallet?.adapter?.publicKey) return;
    setAirdropProcessing(true);
    setAirdropError(null);
    try {
      let paymentSignature = null;
      if (airdropQuote.claim_fee > 0 && airdropQuote.fee_recipient) {
        paymentSignature = await createPaymentTx(airdropQuote.fee_recipient, airdropQuote.claim_fee);
      }
      const res = await api.user.claimAirdrop({
        wallet_address: wallet.adapter.publicKey.toString(),
        airdrop_config_id: airdropQuote.airdrop.airdrop_config_id,
        payment_signature: paymentSignature,
      });
      setAirdropSuccess({ signature: res.data.signature, tokenSymbol: airdropQuote.airdrop.token_symbol, tokenAmount: airdropQuote.token_amount });
      setShowAirdropModal(false);
      setAirdropQuote(null);
      setAirdrops(prev => prev.filter(a => a.airdrop_config_id !== airdropQuote.airdrop.airdrop_config_id));
    } catch (e) {
      const s = e.response?.status;
      if (s === 409) setAirdropError('Already claimed.');
      else if (s === 410) setAirdropError('Claim window expired.');
      else setAirdropError(e.response?.data?.message || 'Failed to claim airdrop.');
    } finally {
      setAirdropProcessing(false);
    }
  }, [airdropQuote, wallet, createPaymentTx]);

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return 'Expired';
    const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const hasClaimableRewards = rewards.some(r => r.amount > 0);

  // Build per-collection user staking data
  // stakedByCollection: [{ id, name, staked_count }] — user's staked count per collection
  // walletNFTs: NFTs in user's wallet (unstaked), each has collectionId
  // We want: user staked + user wallet total per collection
  const collectionStakingRows = React.useMemo(() => {
    const walletCountByCollection = {};
    walletNFTs.forEach(nft => {
      if (nft.collectionId) {
        walletCountByCollection[nft.collectionId] = (walletCountByCollection[nft.collectionId] || 0) + 1;
      }
    });
    return stats.stakedByCollection.map(col => {
      const stakedCount = parseInt(col.staked_count) || 0;
      const walletCount = walletCountByCollection[col.id] || 0;
      const totalOwned = stakedCount + walletCount;
      return { ...col, stakedCount, totalOwned };
    }).filter(col => col.totalOwned > 0 || col.stakedCount > 0);
  }, [stats.stakedByCollection, walletNFTs]);

  // Global stats map by collection id
  const globalByCollection = React.useMemo(() => {
    const map = {};
    globalStats.forEach(g => { map[g.id] = g; });
    return map;
  }, [globalStats]);

  return (
    <div className="bg-[#111a11] border border-[#1e3a1e] rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.1)] p-6 text-white">

      {/* Success banners */}
      {claimSuccess && (
        <div className="bg-green-950/60 border border-green-700 text-green-400 px-4 py-3 rounded-xl mb-4 text-sm flex justify-between">
          <span>{claimSuccess}</span>
          <button onClick={() => setClaimSuccess(null)} className="text-green-600 hover:text-green-400 ml-4">✕</button>
        </div>
      )}
      {airdropSuccess && (
        <div className="bg-green-950/60 border border-green-700 text-green-400 px-4 py-3 rounded-xl mb-4 text-sm flex justify-between items-center">
          <span>Claimed {parseFloat(airdropSuccess.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })} {airdropSuccess.tokenSymbol}!</span>
          <button onClick={() => setAirdropSuccess(null)} className="text-green-600 hover:text-green-400 ml-4">✕</button>
        </div>
      )}

      {(loading || loadingStats) && !statsLoaded ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" />
        </div>
      ) : (
        <>
          {/* 50/50 layout: left = collection staking table, right = Total Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Left: Collection-wise user staking */}
            <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4">
              <div className="text-xs text-green-600 uppercase tracking-widest mb-3">Your Staking</div>
              {collectionStakingRows.length === 0 ? (
                <div className="text-sm text-green-800 py-2">No NFTs staked yet</div>
              ) : (
                <div className="space-y-2">
                  {collectionStakingRows.map(col => {
                    const global = globalByCollection[col.id];
                    const total = global?.hashlist_count || col.totalOwned;
                    return (
                      <div key={col.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">{col.name}</span>
                        <span className="font-semibold text-green-400">
                          {col.stakedCount}/{total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Global totals removed — hashlist counts now shown in main rows */}
            </div>

            {/* Right: Rewards per token + Claim */}
            <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs text-green-600 uppercase tracking-widest mb-3">Rewards Earning</div>
                {rewards.length === 0 ? (
                  <div className="text-sm text-green-800 py-2">No rewards yet — stake NFTs to start earning</div>
                ) : (
                  <div className="space-y-2">
                    {rewards.map((r, i) => (
                      <div key={i} className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-400">{r.token_symbol}</span>
                        <span className="text-lg font-bold text-green-400">{formatToken(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleClaimClick}
                disabled={!hasClaimableRewards || claimProcessing}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:bg-green-900 disabled:text-green-700 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {claimProcessing ? 'Processing...' : 'Claim Rewards'}
              </button>
            </div>
          </div>

          {/* Airdrops section */}
          {(airdrops.length > 0 || airdropError) && (
            <div className="border-t border-[#1e3a1e] pt-5">
              <div className="text-xs text-green-600 uppercase tracking-widest mb-3">Available Airdrops</div>
              {airdropError && (
                <div className="bg-red-950/60 border border-red-700 text-red-400 px-3 py-2 rounded-xl mb-3 text-sm flex justify-between">
                  <span>{airdropError}</span>
                  <button onClick={() => setAirdropError(null)} className="ml-2">✕</button>
                </div>
              )}
              <div className="space-y-3">
                {airdrops.map(airdrop => {
                  const expired = airdrop.time_remaining_seconds <= 0;
                  return (
                    <div key={airdrop.airdrop_config_id} className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 flex justify-between items-center hover:border-green-700 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-green-300">{airdrop.collection_name} — {airdrop.token_symbol}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{parseFloat(airdrop.token_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} {airdrop.token_symbol}</div>
                        <div className={`text-xs mt-0.5 ${expired ? 'text-red-500' : 'text-green-600'}`}>
                          {formatCountdown(airdrop.time_remaining_seconds)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAirdropClaim(airdrop)}
                        disabled={expired || airdropProcessing}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_10px_rgba(34,197,94,0.3)] disabled:bg-green-900 disabled:text-green-700 disabled:shadow-none disabled:cursor-not-allowed"
                      >
                        {expired ? 'Expired' : 'Claim'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Claim Rewards Modal */}
      {showClaimModal && claimQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={!claimProcessing ? () => { setShowClaimModal(false); setClaimQuote(null); } : undefined} />
          <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-green-400 mb-5">Confirm Reward Claim</h3>
            {claimProcessing ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-green-500 mb-4" />
                <p className="text-green-300 font-medium">{claimStatus}</p>
                <p className="text-green-800 text-xs mt-3 text-center">Do not close this window</p>
              </div>
            ) : (
              <>
                {claimError && (
                  <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">{claimError}</div>
                )}
                {claimQuote.treasury_warning && (
                  <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                    ⚠️ {claimQuote.treasury_warning}
                  </div>
                )}
                <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 mb-4">
                  <div className="text-xs text-green-600 uppercase tracking-widest mb-3">Rewards to Claim</div>
                  {claimQuote.rewards?.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{r.token_symbol}</span>
                      <span className="text-green-400">{formatToken(r.amount)}</span>
                    </div>
                  ))}
                  {claimQuote.total_claim_fee > 0 && (
                    <div className="border-t border-[#1e3a1e] pt-2 mt-2 flex justify-between text-sm">
                      <span className="text-gray-400">Claim Fee</span>
                      <span className="text-yellow-400">{formatSol(claimQuote.total_claim_fee)} SOL</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowClaimModal(false); setClaimQuote(null); }}
                    className="flex-1 py-2.5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all">
                    Cancel
                  </button>
                  <button onClick={executeClaimWithPayment}
                    disabled={!!claimQuote.treasury_warning}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none">
                    {claimQuote.total_claim_fee > 0 ? `Pay ${formatSol(claimQuote.total_claim_fee)} SOL & Claim` : 'Claim Rewards'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Airdrop Claim Modal */}
      {showAirdropModal && airdropQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={!airdropProcessing ? () => { setShowAirdropModal(false); setAirdropQuote(null); } : undefined} />
          <div className="relative bg-[#111a11] border border-[#1e3a1e] rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.2)] max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-green-400 mb-5">Confirm Airdrop Claim</h3>
            {airdropProcessing ? (
              <div className="flex flex-col items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-green-500 mb-4" />
                <p className="text-green-300 text-sm">Processing...</p>
              </div>
            ) : (
              <>
                {airdropError && (
                  <div className="bg-red-950/60 border border-red-700 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">{airdropError}</div>
                )}
                <div className="bg-[#0d1a0d] border border-[#1e3a1e] rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">You receive</span>
                    <span className="text-green-400 font-semibold">{parseFloat(airdropQuote.token_amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} {airdropQuote.airdrop.token_symbol}</span>
                  </div>
                  {airdropQuote.claim_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Claim fee</span>
                      <span className="text-yellow-400">{formatSol(airdropQuote.claim_fee)} SOL</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowAirdropModal(false); setAirdropQuote(null); }}
                    className="flex-1 py-2.5 border border-[#1e3a1e] rounded-xl text-sm font-medium text-gray-400 bg-[#0d1a0d] hover:border-green-700 hover:text-green-400 transition-all">
                    Cancel
                  </button>
                  <button onClick={executeAirdropClaim}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black bg-green-500 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                    {airdropQuote.claim_fee > 0 ? `Pay & Claim` : 'Claim Airdrop'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StakingStats;
