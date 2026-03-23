/**
 * Migration: Create airdrop_configs and airdrop_snapshots tables
 *
 * This migration creates the two tables required for the airdrop system:
 *
 * - airdrop_configs: stores airdrop configuration (type, token, eligibility rules, status)
 * - airdrop_snapshots: stores per-wallet eligibility snapshots locked at activation time
 *
 * The migration is idempotent and can be safely run multiple times.
 */

/**
 * Apply the migration (up)
 */
async function up(connection) {
  console.log('Starting migration: 005_create_airdrop_tables');

  await connection.beginTransaction();

  try {
    // ----------------------------------------------------------------
    // airdrop_configs
    // ----------------------------------------------------------------
    console.log('Checking if airdrop_configs table exists...');
    const [configTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'airdrop_configs'
    `);

    if (configTables[0].count === 0) {
      console.log('Creating airdrop_configs table...');
      await connection.query(`
        CREATE TABLE airdrop_configs (
          id                SERIAL PRIMARY KEY,
          collection_id     INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
          airdrop_type      VARCHAR(20) NOT NULL CHECK (airdrop_type IN ('threshold', 'trait')),
          token_address     VARCHAR(100) NOT NULL,
          token_symbol      VARCHAR(20) NOT NULL,
          token_decimals    INTEGER NOT NULL DEFAULT 9,
          amount_per_nft    NUMERIC(20, 9) NOT NULL,
          minimum_threshold INTEGER,
          trait_type        VARCHAR(100),
          trait_value       VARCHAR(100),
          status            VARCHAR(20) NOT NULL DEFAULT 'inactive'
                            CHECK (status IN ('inactive', 'active', 'expired')),
          activated_at      TIMESTAMPTZ,
          expires_at        TIMESTAMPTZ,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('✓ Created airdrop_configs table');
    } else {
      console.log('✓ airdrop_configs table already exists');
    }

    // Indexes for airdrop_configs
    console.log('Verifying indexes on airdrop_configs...');
    const [configIndexes] = await connection.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'airdrop_configs'
    `);
    const configIndexNames = configIndexes.map(r => r.indexname);

    if (!configIndexNames.includes('idx_airdrop_configs_collection')) {
      console.log('Creating index idx_airdrop_configs_collection...');
      await connection.query(`
        CREATE INDEX idx_airdrop_configs_collection ON airdrop_configs(collection_id)
      `);
      console.log('✓ Created idx_airdrop_configs_collection');
    } else {
      console.log('✓ idx_airdrop_configs_collection already exists');
    }

    if (!configIndexNames.includes('idx_airdrop_configs_status')) {
      console.log('Creating index idx_airdrop_configs_status...');
      await connection.query(`
        CREATE INDEX idx_airdrop_configs_status ON airdrop_configs(status)
      `);
      console.log('✓ Created idx_airdrop_configs_status');
    } else {
      console.log('✓ idx_airdrop_configs_status already exists');
    }

    // ----------------------------------------------------------------
    // airdrop_snapshots
    // ----------------------------------------------------------------
    console.log('Checking if airdrop_snapshots table exists...');
    const [snapshotTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'airdrop_snapshots'
    `);

    if (snapshotTables[0].count === 0) {
      console.log('Creating airdrop_snapshots table...');
      await connection.query(`
        CREATE TABLE airdrop_snapshots (
          id                  SERIAL PRIMARY KEY,
          airdrop_config_id   INTEGER NOT NULL REFERENCES airdrop_configs(id) ON DELETE CASCADE,
          wallet_address      VARCHAR(100) NOT NULL,
          eligible_nft_count  INTEGER NOT NULL,
          token_amount        NUMERIC(20, 9) NOT NULL,
          claimed             BOOLEAN NOT NULL DEFAULT FALSE,
          claimed_at          TIMESTAMPTZ,
          claim_tx_hash       VARCHAR(200),
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('✓ Created airdrop_snapshots table');
    } else {
      console.log('✓ airdrop_snapshots table already exists');
    }

    // Indexes for airdrop_snapshots
    console.log('Verifying indexes on airdrop_snapshots...');
    const [snapshotIndexes] = await connection.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'airdrop_snapshots'
    `);
    const snapshotIndexNames = snapshotIndexes.map(r => r.indexname);

    if (!snapshotIndexNames.includes('idx_airdrop_snapshots_config')) {
      console.log('Creating index idx_airdrop_snapshots_config...');
      await connection.query(`
        CREATE INDEX idx_airdrop_snapshots_config ON airdrop_snapshots(airdrop_config_id)
      `);
      console.log('✓ Created idx_airdrop_snapshots_config');
    } else {
      console.log('✓ idx_airdrop_snapshots_config already exists');
    }

    if (!snapshotIndexNames.includes('idx_airdrop_snapshots_wallet')) {
      console.log('Creating index idx_airdrop_snapshots_wallet...');
      await connection.query(`
        CREATE INDEX idx_airdrop_snapshots_wallet ON airdrop_snapshots(wallet_address)
      `);
      console.log('✓ Created idx_airdrop_snapshots_wallet');
    } else {
      console.log('✓ idx_airdrop_snapshots_wallet already exists');
    }

    if (!snapshotIndexNames.includes('idx_airdrop_snapshots_claimed')) {
      console.log('Creating index idx_airdrop_snapshots_claimed...');
      await connection.query(`
        CREATE INDEX idx_airdrop_snapshots_claimed ON airdrop_snapshots(claimed)
      `);
      console.log('✓ Created idx_airdrop_snapshots_claimed');
    } else {
      console.log('✓ idx_airdrop_snapshots_claimed already exists');
    }

    if (!snapshotIndexNames.includes('idx_airdrop_snapshots_unique')) {
      console.log('Creating unique index idx_airdrop_snapshots_unique...');
      await connection.query(`
        CREATE UNIQUE INDEX idx_airdrop_snapshots_unique
          ON airdrop_snapshots(airdrop_config_id, wallet_address)
      `);
      console.log('✓ Created idx_airdrop_snapshots_unique');
    } else {
      console.log('✓ idx_airdrop_snapshots_unique already exists');
    }

    await connection.commit();
    console.log('Migration 005_create_airdrop_tables completed successfully');

    return {
      success: true,
      message: 'Migration 005_create_airdrop_tables completed successfully'
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
  console.log('Starting rollback: 005_create_airdrop_tables');

  await connection.beginTransaction();

  try {
    // Drop snapshots first (depends on configs)
    console.log('Checking if airdrop_snapshots table exists...');
    const [snapshotTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'airdrop_snapshots'
    `);

    if (snapshotTables[0].count > 0) {
      console.log('Dropping airdrop_snapshots table...');
      await connection.query(`DROP TABLE airdrop_snapshots`);
      console.log('✓ Dropped airdrop_snapshots table');
    } else {
      console.log('✓ airdrop_snapshots table does not exist');
    }

    // Then drop configs
    console.log('Checking if airdrop_configs table exists...');
    const [configTables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'airdrop_configs'
    `);

    if (configTables[0].count > 0) {
      console.log('Dropping airdrop_configs table...');
      await connection.query(`DROP TABLE airdrop_configs`);
      console.log('✓ Dropped airdrop_configs table');
    } else {
      console.log('✓ airdrop_configs table does not exist');
    }

    await connection.commit();
    console.log('Rollback 005_create_airdrop_tables completed successfully');

    return {
      success: true,
      message: 'Rollback 005_create_airdrop_tables completed successfully'
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
