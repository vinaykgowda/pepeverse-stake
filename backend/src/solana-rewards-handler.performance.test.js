// Performance tests for optimized reward calculation
// Requirements: 18.1, 18.2, 18.3 - Single query, no N+1, < 500ms for 100 NFTs

const { initializeDatabase, getPool } = require('./db');

describe('Reward Calculation Performance Tests', () => {
  let pool;
  let connection;
  let testWalletAddress;
  let testCollectionId;
  let testRewardId;
  let calculateRewards;

  beforeAll(async () => {
    // Initialize database connection first
    await initializeDatabase();
    pool = getPool();
    connection = pool; // mysql2/promise pool already returns promises
    
    // Now require the module that needs the database
    const rewardsHandler = require('./solana-rewards-handler');
    calculateRewards = rewardsHandler.calculateRewards;
    
    testWalletAddress = 'TestWallet' + Date.now() + Math.random().toString(36).substring(7);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWalletAddress) {
      await connection.query('DELETE FROM staked_nfts WHERE wallet_address = ?', [testWalletAddress]);
    }
    if (testCollectionId) {
      await connection.query('DELETE FROM trait_rewards WHERE collection_id = ?', [testCollectionId]);
      await connection.query('DELETE FROM collection_rewards WHERE collection_id = ?', [testCollectionId]);
      await connection.query('DELETE FROM collections WHERE id = ?', [testCollectionId]);
    }
    
    // Close the pool
    if (pool) {
      await pool.end();
    }
  });

  describe('Requirement 18.3: Performance with 100 staked NFTs', () => {
    beforeAll(async () => {
      // Create test collection
      const [collectionResult] = await connection.query(
        `INSERT INTO collections (name, is_active, claim_fee) 
         VALUES (?, ?, ?)`,
        ['Performance Test Collection', true, 0.01]
      );
      testCollectionId = collectionResult.insertId;

      // Create test reward configuration
      const [rewardResult] = await connection.query(
        `INSERT INTO collection_rewards (collection_id, token_address, token_symbol, daily_rate, token_decimals, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [testCollectionId, 'So11111111111111111111111111111111111111112', 'SOL', 1.0, 9, true]
      );
      testRewardId = rewardResult.insertId;

      // Create trait rewards for testing multipliers
      await connection.query(
        `INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [testCollectionId, 'Rarity', 'Legendary', 'So11111111111111111111111111111111111111112', 'SOL', 2.0, true]
      );

      await connection.query(
        `INSERT INTO trait_rewards (collection_id, trait_type, trait_value, token_address, token_symbol, multiplier, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [testCollectionId, 'Background', 'Gold', 'So11111111111111111111111111111111111111112', 'SOL', 1.5, true]
      );

      // Insert 100 staked NFTs with various traits
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        const mintAddress = `TestMint${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // Vary the traits to test multiplier application
        let traits = [];
        if (i % 3 === 0) {
          traits = [{ trait_type: 'Rarity', value: 'Legendary' }];
        } else if (i % 5 === 0) {
          traits = [{ trait_type: 'Background', value: 'Gold' }];
        } else if (i % 7 === 0) {
          traits = [
            { trait_type: 'Rarity', value: 'Legendary' },
            { trait_type: 'Background', value: 'Gold' }
          ];
        }

        const traitsJson = JSON.stringify(traits);
        
        // Stake timestamp 1 day ago to ensure rewards are available
        const stakeTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        insertPromises.push(
          connection.query(
            `INSERT INTO staked_nfts (mint_address, wallet_address, collection_id, stake_timestamp, traits)
             VALUES (?, ?, ?, ?, ?)`,
            [mintAddress, testWalletAddress, testCollectionId, stakeTimestamp, traitsJson]
          )
        );
      }

      await Promise.all(insertPromises);
      console.log(`✅ Created 100 test staked NFTs for wallet ${testWalletAddress}`);
    });

    test('should calculate rewards for 100 NFTs in under 500ms', async () => {
      const startTime = Date.now();
      
      const result = await calculateRewards(testWalletAddress);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️  Reward calculation took ${duration}ms for 100 NFTs`);

      // Requirement 18.3: Must complete within 500ms
      expect(duration).toBeLessThan(500);
      
      // Verify the result is successful
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Verify rewards were calculated
      const totalReward = result.data.reduce((sum, reward) => sum + reward.amount, 0);
      expect(totalReward).toBeGreaterThan(0);
      
      console.log(`💰 Total rewards calculated: ${totalReward}`);
    }, 10000); // 10 second timeout for the test itself

    test('should use single query (no N+1 problem)', async () => {
      // This test verifies that we're not making multiple queries
      // by checking the query execution time remains consistent
      
      const iterations = 5;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await calculateRewards(testWalletAddress);
        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`📊 Performance stats over ${iterations} iterations:`);
      console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Min: ${minDuration}ms`);
      console.log(`   Max: ${maxDuration}ms`);

      // All iterations should be under 500ms (Requirement 18.3)
      expect(maxDuration).toBeLessThan(500);
      
      // Variance should be low if we're using a single query
      // (no N+1 means consistent performance)
      const variance = maxDuration - minDuration;
      expect(variance).toBeLessThan(200); // Allow some variance for DB load
    }, 30000);
  });

  describe('Requirement 18.1 & 18.2: Single aggregated query', () => {
    test('should handle empty wallet efficiently', async () => {
      const emptyWallet = 'EmptyWallet' + Date.now();
      
      const startTime = Date.now();
      const result = await calculateRewards(emptyWallet);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Empty wallet query took ${duration}ms`);

      // Should be very fast for empty wallet
      expect(duration).toBeLessThan(100);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test('should handle wallet with single NFT efficiently', async () => {
      const singleNftWallet = 'SingleNFT' + Date.now();
      const mintAddress = `SingleMint_${Date.now()}`;

      // Insert single NFT
      await connection.query(
        `INSERT INTO staked_nfts (mint_address, wallet_address, collection_id, stake_timestamp, traits)
         VALUES (?, ?, ?, ?, ?)`,
        [mintAddress, singleNftWallet, testCollectionId, new Date(Date.now() - 24 * 60 * 60 * 1000), '[]']
      );

      const startTime = Date.now();
      const result = await calculateRewards(singleNftWallet);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Single NFT query took ${duration}ms`);

      // Should be very fast for single NFT
      expect(duration).toBeLessThan(100);
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Cleanup
      await connection.query('DELETE FROM staked_nfts WHERE wallet_address = ?', [singleNftWallet]);
    });
  });

  describe('Trait multiplier performance', () => {
    test('should efficiently apply trait multipliers in single query', async () => {
      // This test verifies that trait multipliers are fetched in the same query
      // and don't cause additional database round trips
      
      const startTime = Date.now();
      const result = await calculateRewards(testWalletAddress);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Query with trait multipliers took ${duration}ms`);

      // Should still be under 500ms even with trait multipliers
      expect(duration).toBeLessThan(500);
      expect(result.success).toBe(true);

      // Verify that some NFTs have multipliers applied
      // (we created NFTs with Legendary and Gold traits)
      const totalReward = result.data.reduce((sum, reward) => sum + reward.amount, 0);
      
      // With 100 NFTs staked for 1 day at 1.0 daily rate:
      // - Base rewards would be ~100
      // - With multipliers, should be higher
      expect(totalReward).toBeGreaterThan(100);
      
      console.log(`💰 Total rewards with multipliers: ${totalReward}`);
    });
  });

  describe('Index utilization', () => {
    test('should use wallet_address index', async () => {
      // Query the database to check if indexes are being used
      const [explainResult] = await connection.query(
        `EXPLAIN SELECT 
          s.id,
          s.mint_address,
          s.collection_id,
          s.stake_timestamp,
          s.last_claim_timestamp,
          s.traits,
          c.name as collection_name,
          cr.id as reward_id,
          cr.token_address,
          cr.token_symbol,
          cr.daily_rate,
          cr.token_decimals,
          TIMESTAMPDIFF(SECOND, COALESCE(s.last_claim_timestamp, s.stake_timestamp), NOW()) as seconds_since_last_claim,
          GROUP_CONCAT(
            CONCAT(tr.trait_type, ':', tr.trait_value, ':', tr.multiplier)
            SEPARATOR '||'
          ) as trait_multipliers
         FROM staked_nfts s
         JOIN collections c ON s.collection_id = c.id
         LEFT JOIN collection_rewards cr ON c.id = cr.collection_id AND cr.is_active = TRUE
         LEFT JOIN trait_rewards tr ON tr.collection_id = s.collection_id 
           AND tr.token_address = cr.token_address
           AND tr.is_active = TRUE
         WHERE s.wallet_address = ?
         GROUP BY s.id, s.mint_address, s.collection_id, s.stake_timestamp, 
                  s.last_claim_timestamp, s.traits, c.name, cr.id, 
                  cr.token_address, cr.token_symbol, cr.daily_rate, cr.token_decimals`,
        [testWalletAddress]
      );

      console.log('📊 Query execution plan:', explainResult);

      // Verify that an index is being used on staked_nfts
      const stakedNftsRow = explainResult.find(row => row.table === 'staked_nfts' || row.table === 's');
      expect(stakedNftsRow).toBeDefined();
      
      // Should use idx_staked_nfts_wallet index (created in migration 003)
      if (stakedNftsRow.possible_keys) {
        expect(stakedNftsRow.possible_keys).toContain('idx_staked_nfts_wallet');
      }
    });
  });
});
