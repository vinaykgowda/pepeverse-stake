/**
 * Migration: Add missing columns to database schema
 * 
 * This migration adds:
 * - last_claim_timestamp column to staked_nfts table
 * - collection_id column to transactions table
 * - nft_count column to transactions table
 * 
 * The migration is idempotent and can be safely run multiple times.
 */

const mysql = require('mysql2/promise');

/**
 * Apply the migration (up)
 */
async function up(connection) {
  console.log('Starting migration: 001_add_missing_columns');
  
  await connection.beginTransaction();
  
  try {
    // Check and add last_claim_timestamp to staked_nfts
    console.log('Checking staked_nfts table for last_claim_timestamp column...');
    const [stakedNftsColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts' 
        AND COLUMN_NAME = 'last_claim_timestamp'
    `);
    
    if (stakedNftsColumns.length === 0) {
      console.log('Adding last_claim_timestamp column to staked_nfts table...');
      await connection.query(`
        ALTER TABLE staked_nfts 
        ADD COLUMN last_claim_timestamp TIMESTAMP NULL 
        AFTER stake_timestamp
      `);
      console.log('✓ Added last_claim_timestamp column');
    } else {
      console.log('✓ last_claim_timestamp column already exists');
    }
    
    // Check and add collection_id to transactions
    console.log('Checking transactions table for collection_id column...');
    const [transactionsCollectionIdColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'collection_id'
    `);
    
    if (transactionsCollectionIdColumns.length === 0) {
      console.log('Adding collection_id column to transactions table...');
      await connection.query(`
        ALTER TABLE transactions 
        ADD COLUMN collection_id INT NULL 
        AFTER transaction_hash
      `);
      console.log('✓ Added collection_id column');
    } else {
      console.log('✓ collection_id column already exists');
    }
    
    // Check and add nft_count to transactions
    console.log('Checking transactions table for nft_count column...');
    const [transactionsNftCountColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'nft_count'
    `);
    
    if (transactionsNftCountColumns.length === 0) {
      console.log('Adding nft_count column to transactions table...');
      await connection.query(`
        ALTER TABLE transactions 
        ADD COLUMN nft_count INT DEFAULT 1 
        AFTER collection_id
      `);
      console.log('✓ Added nft_count column');
    } else {
      console.log('✓ nft_count column already exists');
    }
    
    // Check and add foreign key constraint for transactions.collection_id
    console.log('Checking for foreign key constraint on transactions.collection_id...');
    const [fkConstraints] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (fkConstraints.length === 0) {
      console.log('Adding foreign key constraint for transactions.collection_id...');
      await connection.query(`
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_collection_fk
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `);
      console.log('✓ Added foreign key constraint');
    } else {
      console.log('✓ Foreign key constraint already exists');
    }
    
    // Verify all changes
    console.log('Verifying migration changes...');
    const [verifyStakedNfts] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts' 
        AND COLUMN_NAME = 'last_claim_timestamp'
    `);
    
    const [verifyTransactions] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME IN ('collection_id', 'nft_count')
      ORDER BY COLUMN_NAME
    `);
    
    if (verifyStakedNfts.length === 0 || verifyTransactions.length < 2) {
      throw new Error('Migration verification failed: columns not found after creation');
    }
    
    console.log('✓ Migration verification successful');
    
    await connection.commit();
    console.log('Migration completed successfully');
    
    return {
      success: true,
      message: 'Migration 001_add_missing_columns completed successfully'
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
  console.log('Starting rollback: 001_add_missing_columns');
  
  await connection.beginTransaction();
  
  try {
    // Drop foreign key constraint first
    console.log('Checking for foreign key constraint to drop...');
    const [fkConstraints] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (fkConstraints.length > 0) {
      const constraintName = fkConstraints[0].CONSTRAINT_NAME;
      console.log(`Dropping foreign key constraint ${constraintName}...`);
      await connection.query(`
        ALTER TABLE transactions 
        DROP FOREIGN KEY ${constraintName}
      `);
      console.log('✓ Dropped foreign key constraint');
    }
    
    // Drop collection_id column from transactions
    console.log('Checking for collection_id column to drop...');
    const [transactionsCollectionIdColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'collection_id'
    `);
    
    if (transactionsCollectionIdColumns.length > 0) {
      console.log('Dropping collection_id column from transactions...');
      await connection.query(`
        ALTER TABLE transactions 
        DROP COLUMN collection_id
      `);
      console.log('✓ Dropped collection_id column');
    }
    
    // Drop nft_count column from transactions
    console.log('Checking for nft_count column to drop...');
    const [transactionsNftCountColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND COLUMN_NAME = 'nft_count'
    `);
    
    if (transactionsNftCountColumns.length > 0) {
      console.log('Dropping nft_count column from transactions...');
      await connection.query(`
        ALTER TABLE transactions 
        DROP COLUMN nft_count
      `);
      console.log('✓ Dropped nft_count column');
    }
    
    // Drop last_claim_timestamp column from staked_nfts
    console.log('Checking for last_claim_timestamp column to drop...');
    const [stakedNftsColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts' 
        AND COLUMN_NAME = 'last_claim_timestamp'
    `);
    
    if (stakedNftsColumns.length > 0) {
      console.log('Dropping last_claim_timestamp column from staked_nfts...');
      await connection.query(`
        ALTER TABLE staked_nfts 
        DROP COLUMN last_claim_timestamp
      `);
      console.log('✓ Dropped last_claim_timestamp column');
    }
    
    await connection.commit();
    console.log('Rollback completed successfully');
    
    return {
      success: true,
      message: 'Rollback 001_add_missing_columns completed successfully'
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
