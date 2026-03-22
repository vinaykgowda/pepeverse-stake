#!/usr/bin/env node

/**
 * Staging Database Migration Testing Script
 * 
 * This comprehensive script tests migrations on a staging database by:
 * 1. Creating a backup of the staging database
 * 2. Running all pending migrations
 * 3. Verifying schema changes
 * 4. Testing rollback procedures
 * 5. Optionally restoring from backup
 * 
 * Usage:
 *   node test-staging.js [options]
 * 
 * Options:
 *   --skip-backup       Skip database backup (not recommended)
 *   --skip-rollback     Skip rollback testing
 *   --restore           Restore from backup after testing
 *   --backup-only       Only create backup, don't run migrations
 * 
 * Examples:
 *   node test-staging.js                    - Full test with backup
 *   node test-staging.js --restore          - Test and restore after
 *   node test-staging.js --backup-only      - Only create backup
 * 
 * IMPORTANT: This script should be run on a staging database only!
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env.staging') });

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

// Backup configuration
const backupDir = path.join(__dirname, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                  new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0];
const backupFile = path.join(backupDir, `staging_backup_${timestamp}.sql`);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipBackup: args.includes('--skip-backup'),
    skipRollback: args.includes('--skip-rollback'),
    restore: args.includes('--restore'),
    backupOnly: args.includes('--backup-only')
  };
}

/**
 * Create backup directory if it doesn't exist
 */
function ensureBackupDirectory() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✓ Created backup directory: ${backupDir}`);
  }
}

/**
 * Create database backup using mysqldump
 */
async function createBackup() {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 1: Creating Database Backup');
  console.log('='.repeat(70) + '\n');
  
  try {
    ensureBackupDirectory();
    
    console.log('Creating backup...');
    console.log(`  Database: ${dbConfig.database}`);
    console.log(`  Backup file: ${backupFile}`);
    
    // Build mysqldump command
    const dumpCommand = [
      'mysqldump',
      `-h${dbConfig.host}`,
      `-P${dbConfig.port}`,
      `-u${dbConfig.user}`,
      dbConfig.password ? `-p${dbConfig.password}` : '',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--add-drop-table',
      '--complete-insert',
      '--extended-insert',
      dbConfig.database,
      `> "${backupFile}"`
    ].filter(Boolean).join(' ');
    
    // Execute backup
    execSync(dumpCommand, { 
      stdio: 'inherit',
      shell: true 
    });
    
    // Verify backup file was created
    if (!fs.existsSync(backupFile)) {
      throw new Error('Backup file was not created');
    }
    
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n✓ Backup created successfully`);
    console.log(`  File size: ${fileSizeMB} MB`);
    console.log(`  Location: ${backupFile}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('\n✗ Backup failed:', error.message);
    throw error;
  }
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
 * Get list of applied migrations
 */
async function getAppliedMigrations(connection) {
  try {
    const [rows] = await connection.query(
      'SELECT name FROM migrations ORDER BY applied_at ASC'
    );
    return rows.map(row => row.name);
  } catch (error) {
    // Table doesn't exist yet
    return [];
  }
}

/**
 * Capture database schema state
 */
async function captureSchemaState(connection) {
  const state = {
    tables: {},
    foreignKeys: {},
    indexes: {},
    rowCounts: {}
  };
  
  // Get all tables
  const [tables] = await connection.query(`
    SELECT TABLE_NAME, TABLE_ROWS
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  
  for (const table of tables) {
    const tableName = table.TABLE_NAME;
    state.rowCounts[tableName] = table.TABLE_ROWS;
    
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
        NON_UNIQUE,
        INDEX_TYPE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE
      ORDER BY INDEX_NAME
    `, [tableName]);
    
    state.indexes[tableName] = indexes;
  }
  
  return state;
}

/**
 * Run migrations on staging database
 */
async function runMigrations(connection) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Running Migrations');
  console.log('='.repeat(70) + '\n');
  
  try {
    // Ensure migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    const applied = await getAppliedMigrations(connection);
    const available = getAvailableMigrations();
    const pending = available.filter(name => !applied.includes(name));
    
    console.log(`Total migrations: ${available.length}`);
    console.log(`Applied: ${applied.length}`);
    console.log(`Pending: ${pending.length}\n`);
    
    if (pending.length === 0) {
      console.log('✓ No pending migrations to run');
      return { applied: [], skipped: applied.length };
    }
    
    console.log('Pending migrations:');
    pending.forEach(m => console.log(`  - ${m}`));
    console.log();
    
    const results = [];
    
    for (const name of pending) {
      console.log(`\nApplying migration: ${name}`);
      console.log('-'.repeat(70));
      
      try {
        const migrationPath = path.join(__dirname, `${name}.js`);
        const migration = require(migrationPath);
        
        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${name} does not export an 'up' function`);
        }
        
        const startTime = Date.now();
        await migration.up(connection);
        const duration = Date.now() - startTime;
        
        // Record migration
        await connection.query(
          'INSERT INTO migrations (name) VALUES (?)',
          [name]
        );
        
        console.log(`✓ Migration ${name} completed in ${duration}ms`);
        results.push({ name, success: true, duration });
        
      } catch (error) {
        console.error(`✗ Migration ${name} failed:`, error.message);
        results.push({ name, success: false, error: error.message });
        throw error;
      }
    }
    
    console.log('\n✓ All migrations completed successfully');
    return { applied: results, skipped: applied.length };
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Verify schema changes
 */
async function verifySchemaChanges(connection, beforeState) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Verifying Schema Changes');
  console.log('='.repeat(70) + '\n');
  
  try {
    const afterState = await captureSchemaState(connection);
    const changes = [];
    
    // Check for new tables
    const beforeTables = Object.keys(beforeState.tables);
    const afterTables = Object.keys(afterState.tables);
    const newTables = afterTables.filter(t => !beforeTables.includes(t));
    
    if (newTables.length > 0) {
      console.log('New tables created:');
      newTables.forEach(table => {
        console.log(`  ✓ ${table}`);
        changes.push(`Added table: ${table}`);
      });
      console.log();
    }
    
    // Check for new columns in existing tables
    const commonTables = beforeTables.filter(t => afterTables.includes(t));
    for (const table of commonTables) {
      const beforeCols = beforeState.tables[table].map(c => c.COLUMN_NAME);
      const afterCols = afterState.tables[table].map(c => c.COLUMN_NAME);
      const newCols = afterCols.filter(c => !beforeCols.includes(c));
      
      if (newCols.length > 0) {
        console.log(`${table} - New columns:`);
        newCols.forEach(col => {
          const colDef = afterState.tables[table].find(c => c.COLUMN_NAME === col);
          console.log(`  ✓ ${col} (${colDef.COLUMN_TYPE})`);
          changes.push(`${table}: Added column ${col}`);
        });
        console.log();
      }
    }
    
    // Check for new foreign keys
    const beforeFkTables = Object.keys(beforeState.foreignKeys);
    const afterFkTables = Object.keys(afterState.foreignKeys);
    const allFkTables = [...new Set([...beforeFkTables, ...afterFkTables])];
    
    for (const table of allFkTables) {
      const beforeFks = beforeState.foreignKeys[table] || [];
      const afterFks = afterState.foreignKeys[table] || [];
      
      const beforeFkNames = beforeFks.map(fk => fk.CONSTRAINT_NAME);
      const afterFkNames = afterFks.map(fk => fk.CONSTRAINT_NAME);
      const newFks = afterFkNames.filter(fk => !beforeFkNames.includes(fk));
      
      if (newFks.length > 0) {
        console.log(`${table} - New foreign keys:`);
        newFks.forEach(fkName => {
          const fk = afterFks.find(f => f.CONSTRAINT_NAME === fkName);
          console.log(`  ✓ ${fkName}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
          console.log(`    ON DELETE ${fk.DELETE_RULE}, ON UPDATE ${fk.UPDATE_RULE}`);
          changes.push(`${table}: Added foreign key ${fkName}`);
        });
        console.log();
      }
      
      // Check for modified foreign keys (CASCADE rules)
      const commonFks = beforeFkNames.filter(fk => afterFkNames.includes(fk));
      for (const fkName of commonFks) {
        const beforeFk = beforeFks.find(f => f.CONSTRAINT_NAME === fkName);
        const afterFk = afterFks.find(f => f.CONSTRAINT_NAME === fkName);
        
        if (beforeFk.DELETE_RULE !== afterFk.DELETE_RULE || 
            beforeFk.UPDATE_RULE !== afterFk.UPDATE_RULE) {
          console.log(`${table} - Modified foreign key:`);
          console.log(`  ✓ ${fkName}:`);
          console.log(`    Before: ON DELETE ${beforeFk.DELETE_RULE}, ON UPDATE ${beforeFk.UPDATE_RULE}`);
          console.log(`    After:  ON DELETE ${afterFk.DELETE_RULE}, ON UPDATE ${afterFk.UPDATE_RULE}`);
          changes.push(`${table}: Modified foreign key ${fkName} CASCADE rules`);
          console.log();
        }
      }
    }
    
    // Check for new indexes
    const beforeIdxTables = Object.keys(beforeState.indexes);
    const afterIdxTables = Object.keys(afterState.indexes);
    const allIdxTables = [...new Set([...beforeIdxTables, ...afterIdxTables])];
    
    for (const table of allIdxTables) {
      const beforeIdxs = beforeState.indexes[table] || [];
      const afterIdxs = afterState.indexes[table] || [];
      
      const beforeIdxNames = beforeIdxs.map(idx => idx.INDEX_NAME);
      const afterIdxNames = afterIdxs.map(idx => idx.INDEX_NAME);
      const newIdxs = afterIdxNames.filter(idx => !beforeIdxNames.includes(idx));
      
      if (newIdxs.length > 0) {
        console.log(`${table} - New indexes:`);
        newIdxs.forEach(idxName => {
          const idx = afterIdxs.find(i => i.INDEX_NAME === idxName);
          const idxType = idx.NON_UNIQUE === 0 ? 'UNIQUE' : 'INDEX';
          console.log(`  ✓ ${idxName} (${idxType}) on (${idx.columns})`);
          changes.push(`${table}: Added index ${idxName}`);
        });
        console.log();
      }
    }
    
    if (changes.length === 0) {
      console.log('⚠ No schema changes detected');
    } else {
      console.log(`✓ Verified ${changes.length} schema change(s)`);
    }
    
    return { changes, afterState };
    
  } catch (error) {
    console.error('\n✗ Schema verification failed:', error.message);
    throw error;
  }
}

/**
 * Test rollback procedures
 */
async function testRollbackProcedures(connection) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Testing Rollback Procedures');
  console.log('='.repeat(70) + '\n');
  
  try {
    const applied = await getAppliedMigrations(connection);
    
    if (applied.length === 0) {
      console.log('⚠ No migrations to rollback');
      return { tested: 0, success: true };
    }
    
    // Test rollback of the last migration
    const lastMigration = applied[applied.length - 1];
    console.log(`Testing rollback of: ${lastMigration}\n`);
    
    // Capture state before rollback
    console.log('1. Capturing schema state before rollback...');
    const beforeRollback = await captureSchemaState(connection);
    console.log('   ✓ State captured\n');
    
    // Perform rollback
    console.log('2. Executing rollback...');
    const migrationPath = path.join(__dirname, `${lastMigration}.js`);
    const migration = require(migrationPath);
    
    if (typeof migration.down !== 'function') {
      throw new Error(`Migration ${lastMigration} does not export a 'down' function`);
    }
    
    const startTime = Date.now();
    await migration.down(connection);
    const duration = Date.now() - startTime;
    
    // Remove migration record
    await connection.query(
      'DELETE FROM migrations WHERE name = ?',
      [lastMigration]
    );
    
    console.log(`   ✓ Rollback completed in ${duration}ms\n`);
    
    // Capture state after rollback
    console.log('3. Capturing schema state after rollback...');
    const afterRollback = await captureSchemaState(connection);
    console.log('   ✓ State captured\n');
    
    // Re-apply migration to restore state
    console.log('4. Re-applying migration to restore state...');
    await migration.up(connection);
    await connection.query(
      'INSERT INTO migrations (name) VALUES (?)',
      [lastMigration]
    );
    console.log('   ✓ Migration re-applied\n');
    
    // Verify final state matches original
    console.log('5. Verifying final state...');
    const finalState = await captureSchemaState(connection);
    
    // Compare table structures
    const beforeTables = Object.keys(beforeRollback.tables).sort();
    const finalTables = Object.keys(finalState.tables).sort();
    
    if (JSON.stringify(beforeTables) !== JSON.stringify(finalTables)) {
      throw new Error('Table list mismatch after rollback test');
    }
    
    console.log('   ✓ Rollback test successful\n');
    
    console.log('✓ Rollback procedures verified');
    return { tested: 1, success: true, migration: lastMigration };
    
  } catch (error) {
    console.error('\n✗ Rollback test failed:', error.message);
    throw error;
  }
}

/**
 * Restore database from backup
 */
async function restoreFromBackup(backupFile) {
  console.log('\n' + '='.repeat(70));
  console.log('STEP 5: Restoring from Backup');
  console.log('='.repeat(70) + '\n');
  
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    console.log('Restoring database...');
    console.log(`  Backup file: ${backupFile}`);
    console.log(`  Database: ${dbConfig.database}`);
    
    // Build mysql restore command
    const restoreCommand = [
      'mysql',
      `-h${dbConfig.host}`,
      `-P${dbConfig.port}`,
      `-u${dbConfig.user}`,
      dbConfig.password ? `-p${dbConfig.password}` : '',
      dbConfig.database,
      `< "${backupFile}"`
    ].filter(Boolean).join(' ');
    
    // Execute restore
    execSync(restoreCommand, { 
      stdio: 'inherit',
      shell: true 
    });
    
    console.log('\n✓ Database restored successfully');
    
  } catch (error) {
    console.error('\n✗ Restore failed:', error.message);
    throw error;
  }
}

/**
 * Generate test report
 */
function generateReport(results) {
  console.log('\n\n' + '='.repeat(70));
  console.log('STAGING MIGRATION TEST REPORT');
  console.log('='.repeat(70) + '\n');
  
  console.log('Test Configuration:');
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log();
  
  if (results.backup) {
    console.log('Backup:');
    console.log(`  ✓ Created: ${results.backup}`);
    console.log();
  }
  
  if (results.migrations) {
    console.log('Migrations:');
    console.log(`  Applied: ${results.migrations.applied.length}`);
    console.log(`  Skipped: ${results.migrations.skipped}`);
    
    if (results.migrations.applied.length > 0) {
      console.log('\n  Details:');
      results.migrations.applied.forEach(m => {
        const status = m.success ? '✓' : '✗';
        const duration = m.duration ? ` (${m.duration}ms)` : '';
        console.log(`    ${status} ${m.name}${duration}`);
      });
    }
    console.log();
  }
  
  if (results.verification) {
    console.log('Schema Verification:');
    console.log(`  Changes detected: ${results.verification.changes.length}`);
    console.log();
  }
  
  if (results.rollback) {
    console.log('Rollback Test:');
    console.log(`  Migrations tested: ${results.rollback.tested}`);
    console.log(`  Status: ${results.rollback.success ? '✓ Passed' : '✗ Failed'}`);
    if (results.rollback.migration) {
      console.log(`  Migration: ${results.rollback.migration}`);
    }
    console.log();
  }
  
  if (results.restored) {
    console.log('Database Restore:');
    console.log('  ✓ Database restored from backup');
    console.log();
  }
  
  console.log('Overall Status: ✓ All tests passed');
  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();
  
  // Verify we're not running on production
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ ERROR: This script should not be run on production database!');
    process.exit(1);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       Staging Database Migration Testing Script                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  
  console.log('\nConfiguration:');
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Skip Backup: ${options.skipBackup ? 'Yes' : 'No'}`);
  console.log(`  Skip Rollback: ${options.skipRollback ? 'Yes' : 'No'}`);
  console.log(`  Restore After: ${options.restore ? 'Yes' : 'No'}`);
  console.log(`  Backup Only: ${options.backupOnly ? 'Yes' : 'No'}`);
  
  let connection;
  const results = {};
  
  try {
    // Step 1: Create backup
    if (!options.skipBackup) {
      results.backup = await createBackup();
      
      if (options.backupOnly) {
        console.log('\n✓ Backup completed. Exiting (--backup-only flag set)');
        return;
      }
    } else {
      console.log('\n⚠ Skipping backup (--skip-backup flag set)');
    }
    
    // Connect to database
    console.log('\nConnecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database');
    
    // Capture initial state
    const beforeState = await captureSchemaState(connection);
    
    // Step 2: Run migrations
    results.migrations = await runMigrations(connection);
    
    // Step 3: Verify schema changes
    results.verification = await verifySchemaChanges(connection, beforeState);
    
    // Step 4: Test rollback procedures
    if (!options.skipRollback) {
      results.rollback = await testRollbackProcedures(connection);
    } else {
      console.log('\n⚠ Skipping rollback test (--skip-rollback flag set)');
    }
    
    // Step 5: Restore from backup if requested
    if (options.restore && results.backup) {
      await connection.end();
      connection = null;
      await restoreFromBackup(results.backup);
      results.restored = true;
    }
    
    // Generate report
    generateReport(results);
    
    console.log('✓ Staging migration test completed successfully!\n');
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    
    // Offer to restore from backup on failure
    if (results.backup && !options.restore) {
      console.log('\n⚠ Test failed. You can restore from backup using:');
      console.log(`  node test-staging.js --restore`);
      console.log(`  Or manually restore from: ${results.backup}`);
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
  createBackup,
  runMigrations,
  verifySchemaChanges,
  testRollbackProcedures,
  restoreFromBackup
};
