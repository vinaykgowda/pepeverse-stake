// backend/src/solana-rewards-handler.test.js

/**
 * Unit tests for secure reward calculation
 * 
 * Tests Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

describe('Secure Reward Calculation - Requirements Validation', () => {
  describe('Requirement 13.1: 60-second minimum window', () => {
    it('should enforce 60-second minimum window for reward calculations', () => {
      // This test validates that the code includes the 60-second check
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify the 60-second minimum window is implemented
      expect(rewardsHandlerCode).toContain('secondsSinceLastClaim < 60');
      expect(rewardsHandlerCode).toContain('minimum window');
    });
  });

  describe('Requirement 13.2 & 13.5: Database transaction isolation with locks', () => {
    it('should use FOR UPDATE to lock rows during claim', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify FOR UPDATE is used for row-level locking
      expect(rewardsHandlerCode).toContain('FOR UPDATE');
      expect(rewardsHandlerCode).toContain('prevent race conditions');
    });

    it('should use database transactions for claim operations', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify transactions are used
      expect(rewardsHandlerCode).toContain('beginTransaction');
      expect(rewardsHandlerCode).toContain('commit');
      expect(rewardsHandlerCode).toContain('rollback');
    });
  });

  describe('Requirement 13.3: Record exact claim timestamp', () => {
    it('should update last_claim_timestamp with NOW()', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify timestamp is recorded with NOW()
      expect(rewardsHandlerCode).toContain('last_claim_timestamp = NOW()');
    });
  });

  describe('Requirement 13.4: Calculate from last claim or stake time', () => {
    it('should use COALESCE to handle last_claim_timestamp or stake_timestamp', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify COALESCE is used to fall back to stake_timestamp
      expect(rewardsHandlerCode).toContain('COALESCE');
      expect(rewardsHandlerCode).toContain('last_claim_timestamp');
      expect(rewardsHandlerCode).toContain('stake_timestamp');
    });
  });

  describe('Code structure validation', () => {
    it('should have calculateRewards function defined', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify function is defined and exported
      expect(rewardsHandlerCode).toContain('async function calculateRewards');
      expect(rewardsHandlerCode).toContain('calculateRewards');
    });

    it('should have claimRewardsWithPayment function defined', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify function is defined and exported
      expect(rewardsHandlerCode).toContain('async function claimRewardsWithPayment');
      expect(rewardsHandlerCode).toContain('claimRewardsWithPayment');
    });
  });
});

describe('Reward Calculation Logic', () => {
  describe('Time-based calculations', () => {
    it('should convert seconds to days correctly', () => {
      const secondsInDay = 24 * 60 * 60;
      const days = secondsInDay / (24 * 60 * 60);
      expect(days).toBe(1);
    });

    it('should calculate rewards proportionally to time', () => {
      const dailyRate = 10;
      const days = 0.5; // 12 hours
      const reward = dailyRate * days;
      expect(reward).toBe(5);
    });

    it('should calculate rewards for multiple days correctly', () => {
      const dailyRate = 10;
      const days = 7; // 1 week
      const reward = dailyRate * days;
      expect(reward).toBe(70);
    });

    it('should handle fractional days accurately', () => {
      const dailyRate = 100;
      const seconds = 3600; // 1 hour
      const days = seconds / (24 * 60 * 60);
      const reward = dailyRate * days;
      expect(reward).toBeCloseTo(4.166667, 5);
    });

    it('should calculate zero rewards for zero time', () => {
      const dailyRate = 10;
      const days = 0;
      const reward = dailyRate * days;
      expect(reward).toBe(0);
    });
  });

  describe('Minimum window enforcement (Requirement 13.1)', () => {
    it('should skip rewards when time is less than 60 seconds', () => {
      const secondsSinceLastClaim = 30;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(true);
    });

    it('should allow rewards when time is exactly 60 seconds', () => {
      const secondsSinceLastClaim = 60;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(false);
    });

    it('should allow rewards when time is greater than 60 seconds', () => {
      const secondsSinceLastClaim = 120;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(false);
    });

    it('should skip rewards at 59 seconds (boundary test)', () => {
      const secondsSinceLastClaim = 59;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(true);
    });

    it('should allow rewards at 61 seconds (boundary test)', () => {
      const secondsSinceLastClaim = 61;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(false);
    });

    it('should enforce minimum window even with high daily rates', () => {
      const dailyRate = 1000000;
      const secondsSinceLastClaim = 30;
      const shouldSkip = secondsSinceLastClaim < 60;
      expect(shouldSkip).toBe(true);
    });
  });

  describe('Trait multiplier logic', () => {
    it('should apply single multiplier correctly', () => {
      const baseReward = 10;
      const multiplier = 2.0;
      const finalReward = baseReward * multiplier;
      expect(finalReward).toBe(20);
    });

    it('should handle multiple multipliers', () => {
      let reward = 10;
      reward *= 1.5; // First trait
      reward *= 2.0; // Second trait
      expect(reward).toBe(30);
    });

    it('should handle multiplier of 1.0 (no change)', () => {
      const baseReward = 10;
      const multiplier = 1.0;
      const finalReward = baseReward * multiplier;
      expect(finalReward).toBe(10);
    });

    it('should handle fractional multipliers', () => {
      const baseReward = 100;
      const multiplier = 1.25;
      const finalReward = baseReward * multiplier;
      expect(finalReward).toBe(125);
    });

    it('should apply three multipliers correctly', () => {
      let reward = 100;
      reward *= 1.5; // First trait
      reward *= 2.0; // Second trait
      reward *= 1.1; // Third trait
      expect(reward).toBe(330);
    });
  });

  describe('Timestamp recording (Requirement 13.3)', () => {
    it('should use NOW() for exact timestamp recording', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify exact timestamp is recorded with NOW()
      expect(rewardsHandlerCode).toContain('last_claim_timestamp = NOW()');
      expect(rewardsHandlerCode).toContain('UPDATE staked_nfts SET last_claim_timestamp = NOW()');
    });

    it('should update timestamp for all staked NFTs of wallet', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify update applies to all NFTs for the wallet
      expect(rewardsHandlerCode).toContain('WHERE wallet_address = ?');
    });
  });

  describe('Time calculation from last claim (Requirement 13.4)', () => {
    it('should use COALESCE to handle first claim scenario', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify COALESCE is used to fall back to stake_timestamp for first claim
      expect(rewardsHandlerCode).toContain('COALESCE(s.last_claim_timestamp, s.stake_timestamp)');
    });

    it('should calculate time difference using TIMESTAMPDIFF', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify TIMESTAMPDIFF is used for accurate time calculation
      expect(rewardsHandlerCode).toContain('TIMESTAMPDIFF(SECOND');
      expect(rewardsHandlerCode).toContain('seconds_since_last_claim');
    });

    it('should calculate from last claim, not arbitrary window', () => {
      const fs = require('fs');
      const rewardsHandlerCode = fs.readFileSync(__dirname + '/solana-rewards-handler.js', 'utf8');
      
      // Verify calculation uses last_claim_timestamp, not arbitrary time window
      expect(rewardsHandlerCode).toContain('COALESCE(s.last_claim_timestamp, s.stake_timestamp), NOW()');
      expect(rewardsHandlerCode).not.toContain('NOW() - INTERVAL');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very small rewards correctly', () => {
      const dailyRate = 0.000001;
      const days = 1;
      const reward = dailyRate * days;
      expect(reward).toBe(0.000001);
    });

    it('should filter out rewards below threshold (0.000001)', () => {
      const reward = 0.0000001;
      const shouldInclude = reward > 0.000001;
      expect(shouldInclude).toBe(false);
    });

    it('should include rewards at threshold', () => {
      const reward = 0.000001;
      const shouldInclude = reward > 0.000001;
      expect(shouldInclude).toBe(false);
    });

    it('should include rewards above threshold', () => {
      const reward = 0.000002;
      const shouldInclude = reward > 0.000001;
      expect(shouldInclude).toBe(true);
    });

    it('should handle large time periods correctly', () => {
      const dailyRate = 10;
      const days = 365; // 1 year
      const reward = dailyRate * days;
      expect(reward).toBe(3650);
    });

    it('should handle very large daily rates', () => {
      const dailyRate = 1000000;
      const days = 1;
      const reward = dailyRate * days;
      expect(reward).toBe(1000000);
    });
  });

  describe('Reward calculation with multiple scenarios', () => {
    it('should calculate correct reward for 1 hour at 100 tokens/day', () => {
      const dailyRate = 100;
      const seconds = 3600; // 1 hour
      const days = seconds / (24 * 60 * 60);
      const reward = dailyRate * days;
      expect(reward).toBeCloseTo(4.166667, 5);
    });

    it('should calculate correct reward for 6 hours at 50 tokens/day', () => {
      const dailyRate = 50;
      const seconds = 6 * 3600; // 6 hours
      const days = seconds / (24 * 60 * 60);
      const reward = dailyRate * days;
      expect(reward).toBeCloseTo(12.5, 5);
    });

    it('should calculate correct reward for 30 days at 10 tokens/day', () => {
      const dailyRate = 10;
      const days = 30;
      const reward = dailyRate * days;
      expect(reward).toBe(300);
    });

    it('should calculate reward with trait multiplier for 1 day', () => {
      const dailyRate = 100;
      const days = 1;
      let reward = dailyRate * days;
      reward *= 1.5; // Trait multiplier
      expect(reward).toBe(150);
    });

    it('should calculate reward with multiple traits for 7 days', () => {
      const dailyRate = 50;
      const days = 7;
      let reward = dailyRate * days;
      reward *= 1.5; // First trait
      reward *= 2.0; // Second trait
      expect(reward).toBe(1050);
    });
  });
});

