#!/usr/bin/env node

/**
 * Migration Rollback Testing Script
 * 
 * This script tests the rollback functionality of all database migrations
 * by applying and rolling back each migration in sequence.
 * 
 * Usage:
 *   node test-rollback.js [migration-name]
 * 
 * Examples:
 *   node test-rollback.js                     - Test all migrations
 *   node test-rollback.js 001_add_missing_columns - Test specific migration
 * 
 * IMPORTANT: This script should be run on a development database only!
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

// Database configuration
// NO FALLBACK VALUES - All values must be provided via environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
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

/**
 * Get list of available migration files
 */
function getAvailableMigrations() {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir);
  
  return files
    .filter(file => 
      file.endsWith('.js') && 
      file !== 'migrate.js' && 
      !file.startsWith('test-') &&
      !file.startsWith('validate-')
    )
    .map(file => file.replace('.js', ''))
    .sort();
}

/**
 * Capture database schema state
 */
async function captureSchemaState(connection) {
  const state = {
    tables: {},
    foreignKeys: {},
    indexes: {}
  };
  
  // Get all tables
  const [tables] = await connection.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `);
  
  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    
    // Get columns
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [tableName]);
    
    state.tables[tableName] = columns;
    
    // Get foreign keys
    const [fks] = await connection.query(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        DELETE_RULE,
        UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY CONSTRAINT_NAME
    `, [tableName]);
    
    if (fks.length > 0) {
      state.foreignKeys[tableName] = fks;
    }
    
    // Get indexes
    const [indexes] = await connection.query(`
      SELECT 
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as columns,
        NON_UNIQUE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      GROUP BY INDEX_NAME, NON_UNIQUE
      ORDER BY INDEX_NAME
    `, [tableName]);
    
    state.indexes[tableName] = indexes;
  }
  
  return state;
}

/**
 * Compare two schema states
 */
function compareSchemaStates(before, after, migrationName) {
  const differences = [];
  
  // Compare tables
  const beforeTables = Object.keys(before.tables);
  const afterTables = Object.keys(after.tables);
  
  const addedTables = afterTables.filter(t => !beforeTables.includes(t));
  const removedTables = beforeTables.filter(t => !afterTables.includes(t));
  
  if (addedTables.length > 0) {
    differences.push(`Added tables: ${addedTables.join(', ')}`);
  }
  if (removedTables.length > 0) {
    differences.push(`Removed tables: ${removedTables.join(', ')}`);
  }
  
  // Compare columns in common tables
  const commonTables = beforeTables.filter(t => afterTables.includes(t));
  for (const table of commonTables) {
    const beforeCols = before.tables[table].map(c => c.COLUMN_NAME);
    const afterCols = after.tables[table].map(c => c.COLUMN_NAME);
    
    const addedCols = afterCols.filter(c => !beforeCols.includes(c));
    const removedCols = beforeCols.filter(c => !afterCols.includes(c));
    
    if (addedCols.length > 0) {
      differences.push(`${table}: Added columns: ${addedCols.join(', ')}`);
    }
    if (removedCols.length > 0) {
      differences.push(`${table}: Removed columns: ${removedCols.join(', ')}`);
    }
  }
  
  // Compare foreign keys
  const beforeFkTables = Object.keys(before.foreignKeys);
  const afterFkTables = Object.keys(after.foreignKeys);
  
  const allFkTables = [...new Set([...beforeFkTables, ...afterFkTables])];
  for (const table of allFkTables) {
    const beforeFks = before.foreignKeys[table] || [];
    const afterFks = after.foreignKeys[table] || [];
    
    const beforeFkNames = beforeFks.map(fk => fk.CONSTRAINT_NAME);
    const afterFkNames = afterFks.map(fk => fk.CONSTRAINT_NAME);
    
    const addedFks = afterFkNames.filter(fk => !beforeFkNames.includes(fk));
    const removedFks = beforeFkNames.filter(fk => !afterFkNames.includes(fk));
    
    if (addedFks.length > 0) {
      differences.push(`${table}: Added foreign keys: ${addedFks.join(', ')}`);
    }
    if (removedFks.length > 0) {
      differences.push(`${table}: Removed foreign keys: ${removedFks.join(', ')}`);
    }
  }
  
  // Compare indexes
  const beforeIdxTables = Object.keys(before.indexes);
  const afterIdxTables = Object.keys(after.indexes);
  
  const allIdxTables = [...new Set([...beforeIdxTables, ...afterIdxTables])];
  for (const table of allIdxTables) {
    const beforeIdxs = before.indexes[table] || [];
    const afterIdxs = after.indexes[table] || [];
    
    const beforeIdxNames = beforeIdxs.map(idx => idx.INDEX_NAME);
    const afterIdxNames = afterIdxs.map(idx => idx.INDEX_NAME);
    
    const addedIdxs = afterIdxNames.filter(idx => !beforeIdxNames.includes(idx));
    const removedIdxs = beforeIdxNames.filter(idx => !afterIdxNames.includes(idx));
    
    if (addedIdxs.length > 0) {
      differences.push(`${table}: Added indexes: ${addedIdxs.join(', ')}`);
    }
    if (removedIdxs.length > 0) {
      differences.push(`${table}: Removed indexes: ${removedIdxs.join(', ')}`);
    }
  }
  
  return differences;
}

/**
 * Test a single migration's rollback
 */
async function testMigrationRollback(connection, migrationName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing migration: ${migrationName}`);
  console.log('='.repeat(70));
  
  try {
    // Capture initial state
    console.log('\n1. Capturing initial schema state...');
    const initialState = await captureSchemaState(connection);
    console.log('   ✓ Initial state captured');
    
    // Apply migration (up)
    console.log('\n2. Applying migration (up)...');
    const migrationPath = path.join(__dirname, `${migrationName}.js`);
    const migration = require(migrationPath);
    
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${migrationName} does not export an 'up' function`);
    }
    
    await migration.up(connection);
    console.log('   ✓ Migration applied successfully');
    
    // Capture state after up
    console.log('\n3. Capturing schema state after migration...');
    const afterUpState = await captureSchemaState(connection);
    const upDifferences = compareSchemaStates(initialState, afterUpState, migrationName);
    
    if (upDifferences.length > 0) {
      console.log('   Changes made by migration:');
      upDifferences.forEach(diff => console.log(`     - ${diff}`));
    } else {
      console.log('   ⚠ No schema changes detected (migration may be idempotent)');
    }
    
    // Rollback migration (down)
    console.log('\n4. Rolling back migration (down)...');
    
    if (typeof migration.down !== 'function') {
      throw new Error(`Migration ${migrationName} does not export a 'down' function`);
    }
    
    await migration.down(connection);
    console.log('   ✓ Migration rolled back successfully');
    
    // Capture state after down
    console.log('\n5. Capturing schema state after rollback...');
    const afterDownState = await captureSchemaState(connection);
    const downDifferences = compareSchemaStates(afterUpState, afterDownState, migrationName);
    
    if (downDifferences.length > 0) {
      console.log('   Changes made by rollback:');
      downDifferences.forEach(diff => console.log(`     - ${diff}`));
    }
    
    // Verify rollback restored original state
    console.log('\n6. Verifying rollback restored original state...');
    const restorationDifferences = compareSchemaStates(initialState, afterDownState, migrationName);
    
    if (restorationDifferences.length === 0) {
      console.log('   ✓ Schema successfully restored to initial state');
      return { success: true, migration: migrationName };
    } else {
      console.log('   ✗ Schema not fully restored:');
      restorationDifferences.forEach(diff => console.log(`     - ${diff}`));
      return { 
        success: false, 
        migration: migrationName, 
        error: 'Schema not fully restored after rollback',
        differences: restorationDifferences
      };
    }
    
  } catch (error) {
    console.error(`\n   ✗ Error testing ${migrationName}:`, error.message);
    return { 
      success: false, 
      migration: migrationName, 
      error: error.message 
    };
  }
}

/**
 * Main function
 */
async function main() {
  const targetMigration = process.argv[2];
  
  // Verify we're not running on production
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ ERROR: This script should not be run on production database!');
    process.exit(1);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         Migration Rollback Testing Script                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  
  console.log('\n⚠  WARNING: This script will apply and rollback migrations.');
  console.log('   Make sure you are running this on a development database!\n');
  
  let connection;
  
  try {
    console.log('Connecting to database...');
    console.log(`  Host: ${dbConfig.host}`);
    console.log(`  Database: ${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database\n');
    
    // Get migrations to test
    const available = getAvailableMigrations();
    const migrationsToTest = targetMigration 
      ? [targetMigration] 
      : available;
    
    if (migrationsToTest.length === 0) {
      console.log('No migrations found to test');
      return;
    }
    
    if (targetMigration && !available.includes(targetMigration)) {
      console.error(`✗ Migration ${targetMigration} not found`);
      process.exit(1);
    }
    
    console.log(`Testing ${migrationsToTest.length} migration(s):\n`);
    migrationsToTest.forEach(m => console.log(`  - ${m}`));
    
    // Test each migration
    const results = [];
    for (const migration of migrationsToTest) {
      const result = await testMigrationRollback(connection, migration);
      results.push(result);
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(70));
    console.log('ROLLBACK TEST SUMMARY');
    console.log('='.repeat(70) + '\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total migrations tested: ${results.length}`);
    console.log(`✓ Successful: ${successful.length}`);
    console.log(`✗ Failed: ${failed.length}\n`);
    
    if (successful.length > 0) {
      console.log('Successful rollbacks:');
      successful.forEach(r => console.log(`  ✓ ${r.migration}`));
      console.log();
    }
    
    if (failed.length > 0) {
      console.log('Failed rollbacks:');
      failed.forEach(r => {
        console.log(`  ✗ ${r.migration}: ${r.error}`);
        if (r.differences) {
          r.differences.forEach(diff => console.log(`      - ${diff}`));
        }
      });
      console.log();
      process.exit(1);
    }
    
    console.log('✓ All rollback tests passed successfully!\n');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Database connection closed\n');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testMigrationRollback,
  captureSchemaState,
  compareSchemaStates
};
