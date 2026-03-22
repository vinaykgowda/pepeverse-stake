#!/usr/bin/env node

/**
 * Test script to validate migration without applying it
 * 
 * This script performs dry-run validation of the migration:
 * - Checks database connectivity
 * - Validates migration file structure
 * - Checks current schema state
 * - Reports what changes would be made
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

// NO FALLBACK VALUES - All values must be provided via environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Validate required database configuration
const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);

if (missingDbVars.length > 0) {
  console.error('ERROR: Missing required database environment variables:');
  missingDbVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('\nPlease ensure all required variables are set in your .env file.');
  process.exit(1);
}

async function testMigration() {
  let connection;
  
  try {
    console.log('=== Migration Validation Test ===\n');
    
    // Test 1: Database connectivity
    console.log('Test 1: Database Connectivity');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Successfully connected to database\n');
    
    // Test 2: Check current schema state
    console.log('Test 2: Current Schema State');
    
    // Check staked_nfts table
    const [stakedNftsColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nstaked_nfts table columns:');
    stakedNftsColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
    });
    
    const hasLastClaimTimestamp = stakedNftsColumns.some(
      col => col.COLUMN_NAME === 'last_claim_timestamp'
    );
    console.log(`\n  last_claim_timestamp exists: ${hasLastClaimTimestamp ? '✓ Yes' : '○ No (will be added)'}`);
    
    // Check transactions table
    const [transactionsColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\ntransactions table columns:');
    transactionsColumns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
    });
    
    const hasCollectionId = transactionsColumns.some(
      col => col.COLUMN_NAME === 'collection_id'
    );
    const hasNftCount = transactionsColumns.some(
      col => col.COLUMN_NAME === 'nft_count'
    );
    
    console.log(`\n  collection_id exists: ${hasCollectionId ? '✓ Yes' : '○ No (will be added)'}`);
    console.log(`  nft_count exists: ${hasNftCount ? '✓ Yes' : '○ No (will be added)'}`);
    
    // Check foreign key constraints
    const [fkConstraints] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions'
        AND COLUMN_NAME = 'collection_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    console.log(`\n  Foreign key constraint exists: ${fkConstraints.length > 0 ? '✓ Yes' : '○ No (will be added)'}`);
    
    // Test 3: Load and validate migration file
    console.log('\n\nTest 3: Migration File Validation');
    const migration = require('./001_add_missing_columns.js');
    
    if (typeof migration.up !== 'function') {
      throw new Error('Migration does not export an "up" function');
    }
    console.log('✓ Migration exports "up" function');
    
    if (typeof migration.down !== 'function') {
      throw new Error('Migration does not export a "down" function');
    }
    console.log('✓ Migration exports "down" function');
    
    // Test 4: Summary
    console.log('\n\n=== Summary ===\n');
    
    const changesNeeded = [];
    if (!hasLastClaimTimestamp) {
      changesNeeded.push('Add last_claim_timestamp to staked_nfts');
    }
    if (!hasCollectionId) {
      changesNeeded.push('Add collection_id to transactions');
    }
    if (!hasNftCount) {
      changesNeeded.push('Add nft_count to transactions');
    }
    if (fkConstraints.length === 0 && !hasCollectionId) {
      changesNeeded.push('Add foreign key constraint for transactions.collection_id');
    }
    
    if (changesNeeded.length === 0) {
      console.log('✓ All migration changes have already been applied');
      console.log('  Running the migration will be a no-op (safe to run)');
    } else {
      console.log('Changes that will be applied:');
      changesNeeded.forEach((change, index) => {
        console.log(`  ${index + 1}. ${change}`);
      });
      console.log('\nTo apply these changes, run:');
      console.log('  node migrate.js up');
    }
    
    console.log('\n✓ All validation tests passed');
    console.log('✓ Migration is ready to run');
    
  } catch (error) {
    console.error('\n✗ Validation failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Please check:');
      console.error('  - Database server is running');
      console.error('  - DB_HOST and DB_PORT are correct in .env');
      console.error('  - Firewall allows connections');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nAccess denied. Please check:');
      console.error('  - DB_USER and DB_PASSWORD are correct in .env');
      console.error('  - Database user has necessary permissions');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\nDatabase does not exist. Please check:');
      console.error('  - DB_NAME is correct in .env');
      console.error('  - Database has been created');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  testMigration();
}

module.exports = { testMigration };
