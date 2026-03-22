/**
 * Migration: Add performance indexes to database tables
 * 
 * This migration adds indexes to improve query performance:
 * - staked_nfts: owner_wallet, collection_id, stake_timestamp, last_claim_timestamp
 * - transactions: wallet_address, transaction_type, status, created_at
 * - collection_rewards: composite index (collection_id, is_active)
 * - trait_rewards: composite index (collection_id, trait_type, trait_value, is_active)
 * 
 * The migration is idempotent and can be safely run multiple times.
 */

/**
 * Apply the migration (up)
 */
async function up(connection) {
  console.log('Starting migration: 003_add_performance_indexes');
  
  await connection.beginTransaction();
  
  try {
    // Add indexes on staked_nfts table
    console.log('Adding indexes to staked_nfts table...');
    
    // Check and add index on wallet_address
    const [walletAddressIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staked_nfts'
        AND INDEX_NAME = 'idx_staked_nfts_wallet'
    `);
    
    if (walletAddressIndex[0].count === 0) {
      console.log('Creating index on wallet_address...');
      await connection.query(`
        CREATE INDEX idx_staked_nfts_wallet 
        ON staked_nfts(wallet_address)
      `);
      console.log('✓ Created idx_staked_nfts_wallet');
    } else {
      console.log('✓ idx_staked_nfts_wallet already exists');
    }
    
    // Check and add index on collection_id
    const [collectionIdIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staked_nfts'
        AND INDEX_NAME = 'idx_staked_nfts_collection'
    `);
    
    if (collectionIdIndex[0].count === 0) {
      console.log('Creating index on collection_id...');
      await connection.query(`
        CREATE INDEX idx_staked_nfts_collection 
        ON staked_nfts(collection_id)
      `);
      console.log('✓ Created idx_staked_nfts_collection');
    } else {
      console.log('✓ idx_staked_nfts_collection already exists');
    }
    
    // Check and add index on stake_timestamp
    const [stakeTimestampIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staked_nfts'
        AND INDEX_NAME = 'idx_staked_nfts_stake_time'
    `);
    
    if (stakeTimestampIndex[0].count === 0) {
      console.log('Creating index on stake_timestamp...');
      await connection.query(`
        CREATE INDEX idx_staked_nfts_stake_time 
        ON staked_nfts(stake_timestamp)
      `);
      console.log('✓ Created idx_staked_nfts_stake_time');
    } else {
      console.log('✓ idx_staked_nfts_stake_time already exists');
    }
    
    // Check and add index on last_claim_timestamp
    const [claimTimestampIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'staked_nfts'
        AND INDEX_NAME = 'idx_staked_nfts_claim_time'
    `);
    
    if (claimTimestampIndex[0].count === 0) {
      console.log('Creating index on last_claim_timestamp...');
      await connection.query(`
        CREATE INDEX idx_staked_nfts_claim_time 
        ON staked_nfts(last_claim_timestamp)
      `);
      console.log('✓ Created idx_staked_nfts_claim_time');
    } else {
      console.log('✓ idx_staked_nfts_claim_time already exists');
    }
    
    // Add indexes on transactions table
    console.log('\nAdding indexes to transactions table...');
    
    // Check and add index on wallet_address
    const [txWalletAddressIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'transactions'
        AND INDEX_NAME = 'idx_transactions_wallet'
    `);
    
    if (txWalletAddressIndex[0].count === 0) {
      console.log('Creating index on wallet_address...');
      await connection.query(`
        CREATE INDEX idx_transactions_wallet 
        ON transactions(wallet_address)
      `);
      console.log('✓ Created idx_transactions_wallet');
    } else {
      console.log('✓ idx_transactions_wallet already exists');
    }
    
    // Check and add index on transaction_type
    const [transactionTypeIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'transactions'
        AND INDEX_NAME = 'idx_transactions_type'
    `);
    
    if (transactionTypeIndex[0].count === 0) {
      console.log('Creating index on transaction_type...');
      await connection.query(`
        CREATE INDEX idx_transactions_type 
        ON transactions(transaction_type)
      `);
      console.log('✓ Created idx_transactions_type');
    } else {
      console.log('✓ idx_transactions_type already exists');
    }
    
    // Check and add index on status
    const [statusIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'transactions'
        AND INDEX_NAME = 'idx_transactions_status'
    `);
    
    if (statusIndex[0].count === 0) {
      console.log('Creating index on status...');
      await connection.query(`
        CREATE INDEX idx_transactions_status 
        ON transactions(status)
      `);
      console.log('✓ Created idx_transactions_status');
    } else {
      console.log('✓ idx_transactions_status already exists');
    }
    
    // Check and add index on created_at
    const [createdAtIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'transactions'
        AND INDEX_NAME = 'idx_transactions_created'
    `);
    
    if (createdAtIndex[0].count === 0) {
      console.log('Creating index on created_at...');
      await connection.query(`
        CREATE INDEX idx_transactions_created 
        ON transactions(created_at)
      `);
      console.log('✓ Created idx_transactions_created');
    } else {
      console.log('✓ idx_transactions_created already exists');
    }
    
    // Add composite index on collection_rewards
    console.log('\nAdding composite index to collection_rewards table...');
    
    const [collectionRewardsIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'collection_rewards'
        AND INDEX_NAME = 'idx_collection_rewards_active'
    `);
    
    if (collectionRewardsIndex[0].count === 0) {
      console.log('Creating composite index on (collection_id, is_active)...');
      await connection.query(`
        CREATE INDEX idx_collection_rewards_active 
        ON collection_rewards(collection_id, is_active)
      `);
      console.log('✓ Created idx_collection_rewards_active');
    } else {
      console.log('✓ idx_collection_rewards_active already exists');
    }
    
    // Add composite index on trait_rewards
    console.log('\nAdding composite index to trait_rewards table...');
    
    const [traitRewardsIndex] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'trait_rewards'
        AND INDEX_NAME = 'idx_trait_rewards_lookup'
    `);
    
    if (traitRewardsIndex[0].count === 0) {
      console.log('Creating composite index on (collection_id, trait_type, trait_value, is_active)...');
      await connection.query(`
        CREATE INDEX idx_trait_rewards_lookup 
        ON trait_rewards(collection_id, trait_type, trait_value, is_active)
      `);
      console.log('✓ Created idx_trait_rewards_lookup');
    } else {
      console.log('✓ idx_trait_rewards_lookup already exists');
    }
    
    // Verify all indexes were created
    console.log('\nVerifying migration changes...');
    
    const [verifyIndexes] = await connection.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as columns
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('staked_nfts', 'transactions', 'collection_rewards', 'trait_rewards')
        AND INDEX_NAME IN (
          'idx_staked_nfts_wallet',
          'idx_staked_nfts_collection',
          'idx_staked_nfts_stake_time',
          'idx_staked_nfts_claim_time',
          'idx_transactions_wallet',
          'idx_transactions_type',
          'idx_transactions_status',
          'idx_transactions_created',
          'idx_collection_rewards_active',
          'idx_trait_rewards_lookup'
        )
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
    `);
    
    console.log('\nIndexes created:');
    for (const index of verifyIndexes) {
      console.log(`  ${index.TABLE_NAME}.${index.INDEX_NAME} (${index.columns})`);
    }
    
    // Verify we have all 10 expected indexes
    if (verifyIndexes.length < 10) {
      throw new Error(`Migration verification failed: expected 10 indexes, found ${verifyIndexes.length}`);
    }
    
    console.log('\n✓ Migration verification successful');
    
    await connection.commit();
    console.log('Migration completed successfully');
    
    return {
      success: true,
      message: 'Migration 003_add_performance_indexes completed successfully'
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration (down)
 */
async function down(connection) {
  console.log('Starting rollback: 003_add_performance_indexes');
  
  await connection.beginTransaction();
  
  try {
    // Drop indexes from staked_nfts table
    console.log('Dropping indexes from staked_nfts table...');
    
    const stakedNftsIndexes = [
      'idx_staked_nfts_wallet',
      // Skip idx_staked_nfts_collection as it may be used by foreign key
      'idx_staked_nfts_stake_time',
      'idx_staked_nfts_claim_time'
    ];
    
    for (const indexName of stakedNftsIndexes) {
      const [indexExists] = await connection.query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'staked_nfts'
          AND INDEX_NAME = ?
      `, [indexName]);
      
      if (indexExists[0].count > 0) {
        console.log(`Dropping index ${indexName}...`);
        try {
          await connection.query(`DROP INDEX ${indexName} ON staked_nfts`);
          console.log(`✓ Dropped ${indexName}`);
        } catch (error) {
          if (error.message.includes('needed in a foreign key constraint')) {
            console.log(`⚠ Skipped ${indexName} (used by foreign key constraint)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    // Drop indexes from transactions table
    console.log('\nDropping indexes from transactions table...');
    
    const transactionsIndexes = [
      'idx_transactions_wallet',
      'idx_transactions_type',
      'idx_transactions_status',
      'idx_transactions_created'
    ];
    
    for (const indexName of transactionsIndexes) {
      const [indexExists] = await connection.query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transactions'
          AND INDEX_NAME = ?
      `, [indexName]);
      
      if (indexExists[0].count > 0) {
        console.log(`Dropping index ${indexName}...`);
        await connection.query(`DROP INDEX ${indexName} ON transactions`);
        console.log(`✓ Dropped ${indexName}`);
      }
    }
    
    // Drop composite index from collection_rewards
    console.log('\nDropping composite index from collection_rewards table...');
    
    const [collectionRewardsIndexExists] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'collection_rewards'
        AND INDEX_NAME = 'idx_collection_rewards_active'
    `);
    
    if (collectionRewardsIndexExists[0].count > 0) {
      console.log('Dropping idx_collection_rewards_active...');
      try {
        await connection.query(`DROP INDEX idx_collection_rewards_active ON collection_rewards`);
        console.log('✓ Dropped idx_collection_rewards_active');
      } catch (error) {
        if (error.message.includes('needed in a foreign key constraint')) {
          console.log('⚠ Skipped idx_collection_rewards_active (used by foreign key constraint)');
        } else {
          throw error;
        }
      }
    }
    
    // Drop composite index from trait_rewards
    console.log('\nDropping composite index from trait_rewards table...');
    
    const [traitRewardsIndexExists] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'trait_rewards'
        AND INDEX_NAME = 'idx_trait_rewards_lookup'
    `);
    
    if (traitRewardsIndexExists[0].count > 0) {
      console.log('Dropping idx_trait_rewards_lookup...');
      try {
        await connection.query(`DROP INDEX idx_trait_rewards_lookup ON trait_rewards`);
        console.log('✓ Dropped idx_trait_rewards_lookup');
      } catch (error) {
        if (error.message.includes('needed in a foreign key constraint')) {
          console.log('⚠ Skipped idx_trait_rewards_lookup (used by foreign key constraint)');
        } else {
          throw error;
        }
      }
    }
    
    await connection.commit();
    console.log('\nRollback completed successfully');
    
    return {
      success: true,
      message: 'Rollback 003_add_performance_indexes completed successfully'
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Rollback failed:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down
};
