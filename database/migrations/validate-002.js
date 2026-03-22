#!/usr/bin/env node

/**
 * Validation script for migration 002_add_cascade_foreign_keys
 * 
 * This script validates the migration logic without applying it
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

async function validateMigration() {
  let connection;
  
  try {
    console.log('=== Migration 002 Validation ===\n');
    
    // Connect to database
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database\n');
    
    // Check current foreign key constraints
    console.log('Checking current foreign key constraints...\n');
    
    const tables = ['staked_nfts', 'collection_rewards', 'trait_rewards'];
    
    for (const table of tables) {
      console.log(`\n${table}:`);
      
      // Check if foreign key exists
      const [fkInfo] = await connection.query(`
        SELECT 
          kcu.CONSTRAINT_NAME,
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME,
          rc.DELETE_RULE,
          rc.UPDATE_RULE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
          AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = DATABASE()
          AND kcu.TABLE_NAME = ?
          AND kcu.COLUMN_NAME = 'collection_id'
          AND kcu.REFERENCED_TABLE_NAME = 'collections'
      `, [table]);
      
      if (fkInfo.length > 0) {
        const fk = fkInfo[0];
        console.log(`  ✓ Foreign key exists: ${fk.CONSTRAINT_NAME}`);
        console.log(`    ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        console.log(`    ON DELETE ${fk.DELETE_RULE || 'RESTRICT'}`);
        console.log(`    ON UPDATE ${fk.UPDATE_RULE || 'RESTRICT'}`);
        
        if (fk.DELETE_RULE === 'CASCADE' && fk.UPDATE_RULE === 'CASCADE') {
          console.log('    ✓ Already has CASCADE rules');
        } else {
          console.log('    ○ Will be updated to CASCADE rules');
        }
      } else {
        console.log('  ○ No foreign key exists (will be created with CASCADE rules)');
      }
    }
    
    // Check transactions.collection_id foreign key
    console.log('\n\ntransactions:');
    const [txFkInfo] = await connection.query(`
      SELECT 
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME,
        rc.DELETE_RULE,
        rc.UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'transactions'
        AND kcu.COLUMN_NAME = 'collection_id'
        AND kcu.REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (txFkInfo.length > 0) {
      const fk = txFkInfo[0];
      console.log(`  ✓ Foreign key exists: ${fk.CONSTRAINT_NAME}`);
      console.log(`    ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      console.log(`    ON DELETE ${fk.DELETE_RULE || 'RESTRICT'}`);
      console.log(`    ON UPDATE ${fk.UPDATE_RULE || 'RESTRICT'}`);
      
      if (fk.DELETE_RULE === 'SET NULL' && fk.UPDATE_RULE === 'CASCADE') {
        console.log('    ✓ Already has correct rules (SET NULL on DELETE, CASCADE on UPDATE)');
      } else {
        console.log('    ○ Note: This should be handled by migration 001');
      }
    } else {
      console.log('  ○ No foreign key exists (should be created by migration 001)');
    }
    
    // Load and validate migration file
    console.log('\n\nValidating migration file...');
    const migration = require('./002_add_cascade_foreign_keys.js');
    
    if (typeof migration.up !== 'function') {
      throw new Error('Migration does not export an "up" function');
    }
    console.log('✓ Migration exports "up" function');
    
    if (typeof migration.down !== 'function') {
      throw new Error('Migration does not export a "down" function');
    }
    console.log('✓ Migration exports "down" function');
    
    console.log('\n=== Summary ===\n');
    console.log('Migration 002 will update foreign key constraints to include CASCADE rules:');
    console.log('  - staked_nfts.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE');
    console.log('  - collection_rewards.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE');
    console.log('  - trait_rewards.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE');
    console.log('\nThis ensures that when a collection is deleted or updated,');
    console.log('all related records are automatically handled according to CASCADE rules.');
    console.log('\n✓ Validation complete - migration is ready to run');
    
  } catch (error) {
    console.error('\n✗ Validation failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Please check:');
      console.error('  - Database server is running');
      console.error('  - DB_HOST and DB_PORT are correct in .env');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nAccess denied. Please check:');
      console.error('  - DB_USER and DB_PASSWORD are correct in .env');
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
  validateMigration();
}

module.exports = { validateMigration };
