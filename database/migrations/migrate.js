#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * Usage:
 *   node migrate.js up [migration-name]    - Run migrations
 *   node migrate.js down [migration-name]  - Rollback migrations
 *   node migrate.js status                 - Show migration status
 * 
 * Examples:
 *   node migrate.js up                     - Run all pending migrations
 *   node migrate.js up 001_add_missing_columns - Run specific migration
 *   node migrate.js down                   - Rollback last migration
 *   node migrate.js status                 - Show which migrations have been applied
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
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(
    'SELECT name FROM migrations ORDER BY applied_at ASC'
  );
  return rows.map(row => row.name);
}

/**
 * Get list of available migration files
 */
function getAvailableMigrations() {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir);
  
  return files
    .filter(file => file.endsWith('.js') && file !== 'migrate.js' && !file.startsWith('test-'))
    .map(file => file.replace('.js', ''))
    .sort();
}

/**
 * Record migration as applied
 */
async function recordMigration(connection, name) {
  await connection.query(
    'INSERT INTO migrations (name) VALUES (?)',
    [name]
  );
}

/**
 * Remove migration record
 */
async function removeMigrationRecord(connection, name) {
  await connection.query(
    'DELETE FROM migrations WHERE name = ?',
    [name]
  );
}

/**
 * Run migrations
 */
async function runMigrations(connection, targetMigration = null) {
  const applied = await getAppliedMigrations(connection);
  const available = getAvailableMigrations();
  
  let migrationsToRun;
  
  if (targetMigration) {
    // Run specific migration
    if (!available.includes(targetMigration)) {
      throw new Error(`Migration ${targetMigration} not found`);
    }
    if (applied.includes(targetMigration)) {
      console.log(`Migration ${targetMigration} has already been applied`);
      return;
    }
    migrationsToRun = [targetMigration];
  } else {
    // Run all pending migrations
    migrationsToRun = available.filter(name => !applied.includes(name));
  }
  
  if (migrationsToRun.length === 0) {
    console.log('No pending migrations to run');
    return;
  }
  
  console.log(`Running ${migrationsToRun.length} migration(s)...\n`);
  
  for (const name of migrationsToRun) {
    console.log(`\n=== Running migration: ${name} ===`);
    
    try {
      const migrationPath = path.join(__dirname, `${name}.js`);
      const migration = require(migrationPath);
      
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${name} does not export an 'up' function`);
      }
      
      const result = await migration.up(connection);
      await recordMigration(connection, name);
      
      console.log(`✓ Migration ${name} completed successfully`);
      if (result && result.message) {
        console.log(`  ${result.message}`);
      }
    } catch (error) {
      console.error(`✗ Migration ${name} failed:`, error.message);
      throw error;
    }
  }
  
  console.log('\n✓ All migrations completed successfully');
}

/**
 * Rollback migrations
 */
async function rollbackMigrations(connection, targetMigration = null) {
  const applied = await getAppliedMigrations(connection);
  
  if (applied.length === 0) {
    console.log('No migrations to rollback');
    return;
  }
  
  let migrationsToRollback;
  
  if (targetMigration) {
    // Rollback specific migration
    if (!applied.includes(targetMigration)) {
      console.log(`Migration ${targetMigration} has not been applied`);
      return;
    }
    migrationsToRollback = [targetMigration];
  } else {
    // Rollback last migration
    migrationsToRollback = [applied[applied.length - 1]];
  }
  
  console.log(`Rolling back ${migrationsToRollback.length} migration(s)...\n`);
  
  for (const name of migrationsToRollback.reverse()) {
    console.log(`\n=== Rolling back migration: ${name} ===`);
    
    try {
      const migrationPath = path.join(__dirname, `${name}.js`);
      const migration = require(migrationPath);
      
      if (typeof migration.down !== 'function') {
        throw new Error(`Migration ${name} does not export a 'down' function`);
      }
      
      const result = await migration.down(connection);
      await removeMigrationRecord(connection, name);
      
      console.log(`✓ Migration ${name} rolled back successfully`);
      if (result && result.message) {
        console.log(`  ${result.message}`);
      }
    } catch (error) {
      console.error(`✗ Rollback of ${name} failed:`, error.message);
      throw error;
    }
  }
  
  console.log('\n✓ All rollbacks completed successfully');
}

/**
 * Show migration status
 */
async function showStatus(connection) {
  const applied = await getAppliedMigrations(connection);
  const available = getAvailableMigrations();
  
  console.log('\n=== Migration Status ===\n');
  
  if (available.length === 0) {
    console.log('No migrations found');
    return;
  }
  
  for (const name of available) {
    const status = applied.includes(name) ? '✓ Applied' : '○ Pending';
    console.log(`${status}  ${name}`);
  }
  
  console.log(`\nTotal: ${available.length} migrations (${applied.length} applied, ${available.length - applied.length} pending)`);
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];
  const target = process.argv[3];
  
  if (!command || !['up', 'down', 'status'].includes(command)) {
    console.error('Usage: node migrate.js <up|down|status> [migration-name]');
    process.exit(1);
  }
  
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database\n');
    
    await ensureMigrationsTable(connection);
    
    switch (command) {
      case 'up':
        await runMigrations(connection, target);
        break;
      case 'down':
        await rollbackMigrations(connection, target);
        break;
      case 'status':
        await showStatus(connection);
        break;
    }
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackMigrations,
  showStatus
};
