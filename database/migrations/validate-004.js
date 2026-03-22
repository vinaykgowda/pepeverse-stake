#!/usr/bin/env node

/**
 * Validation script for 004_create_audit_logs_table migration
 * 
 * This script validates the migration without applying it:
 * - Checks database connectivity
 * - Validates migration file structure
 * - Checks if audit_logs table exists
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

async function validateMigration() {
  let connection;
  
  try {
    console.log('=== Migration 004 Validation ===\n');
    
    // Test 1: Database connectivity
    console.log('Test 1: Database Connectivity');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Successfully connected to database\n');
    
    // Test 2: Check if admins table exists (required for foreign key)
    console.log('Test 2: Prerequisites Check');
    const [adminsTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'admins'
    `);
    
    if (adminsTables[0].count === 0) {
      console.log('✗ admins table does not exist (required for foreign key)');
      console.log('  Please create the admins table before running this migration');
      process.exit(1);
    }
    console.log('✓ admins table exists\n');
    
    // Test 3: Check current schema state
    console.log('Test 3: Current Schema State');
    
    const [auditLogsTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
    `);
    
    const tableExists = auditLogsTables[0].count > 0;
    console.log(`audit_logs table exists: ${tableExists ? '✓ Yes' : '○ No (will be created)'}`);
    
    if (tableExists) {
      // Check table structure
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_logs'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('\nCurrent audit_logs table columns:');
      columns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
        console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) ${nullable}${defaultVal}`);
      });
      
      // Check foreign key
      const [foreignKeys] = await connection.query(`
        SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_logs'
          AND REFERENCED_TABLE_NAME = 'admins'
      `);
      
      if (foreignKeys.length > 0) {
        console.log(`\nForeign key constraint: ✓ Exists (${foreignKeys[0].CONSTRAINT_NAME})`);
        console.log(`  ON DELETE ${foreignKeys[0].DELETE_RULE}, ON UPDATE ${foreignKeys[0].UPDATE_RULE}`);
      } else {
        console.log('\nForeign key constraint: ○ Missing (will be added)');
      }
      
      // Check indexes
      const [indexes] = await connection.query(`
        SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as columns
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_logs'
          AND INDEX_NAME != 'PRIMARY'
        GROUP BY INDEX_NAME
        ORDER BY INDEX_NAME
      `);
      
      console.log('\nIndexes:');
      if (indexes.length > 0) {
        indexes.forEach(idx => {
          console.log(`  ✓ ${idx.INDEX_NAME} (${idx.columns})`);
        });
      } else {
        console.log('  ○ No indexes (will be created)');
      }
      
      // Check for required indexes
      const indexNames = indexes.map(idx => idx.INDEX_NAME);
      const requiredIndexes = ['idx_audit_logs_admin', 'idx_audit_logs_created', 'idx_audit_logs_entity'];
      const missingIndexes = requiredIndexes.filter(name => !indexNames.includes(name));
      
      if (missingIndexes.length > 0) {
        console.log('\nMissing indexes (will be created):');
        missingIndexes.forEach(name => {
          console.log(`  ○ ${name}`);
        });
      }
    }
    
    // Test 4: Load and validate migration file
    console.log('\n\nTest 4: Migration File Validation');
    const migration = require('./004_create_audit_logs_table.js');
    
    if (typeof migration.up !== 'function') {
      throw new Error('Migration does not export an "up" function');
    }
    console.log('✓ Migration exports "up" function');
    
    if (typeof migration.down !== 'function') {
      throw new Error('Migration does not export a "down" function');
    }
    console.log('✓ Migration exports "down" function');
    
    // Test 5: Summary
    console.log('\n\n=== Summary ===\n');
    
    if (tableExists) {
      console.log('✓ audit_logs table already exists');
      console.log('  Running the migration will verify and update the table structure if needed');
      console.log('  The migration is idempotent and safe to run');
    } else {
      console.log('Changes that will be applied:');
      console.log('  1. Create audit_logs table with columns:');
      console.log('     - id (INT AUTO_INCREMENT PRIMARY KEY)');
      console.log('     - admin_id (INT NOT NULL)');
      console.log('     - action (VARCHAR(100) NOT NULL)');
      console.log('     - entity_type (VARCHAR(50) NOT NULL)');
      console.log('     - entity_id (INT)');
      console.log('     - old_value (JSON)');
      console.log('     - new_value (JSON)');
      console.log('     - ip_address (VARCHAR(45))');
      console.log('     - user_agent (TEXT)');
      console.log('     - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
      console.log('  2. Add foreign key constraint: admin_id -> admins(id) ON DELETE CASCADE');
      console.log('  3. Create indexes:');
      console.log('     - idx_audit_logs_admin (admin_id)');
      console.log('     - idx_audit_logs_created (created_at)');
      console.log('     - idx_audit_logs_entity (entity_type, entity_id)');
      console.log('\nTo apply these changes, run:');
      console.log('  node migrate.js up 004_create_audit_logs_table');
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
  validateMigration();
}

module.exports = { validateMigration };
