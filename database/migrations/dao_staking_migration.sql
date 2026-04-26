-- DAO Staking Migration
-- Adds all tables, columns, indexes, and settings required for the DAO sub-staking system.
-- This script is idempotent — safe to re-run without side effects.

-- ============================================================
-- 1. Add dao_last_claim_timestamp column to staked_nfts
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staked_nfts' AND column_name = 'dao_last_claim_timestamp'
  ) THEN
    ALTER TABLE staked_nfts ADD COLUMN dao_last_claim_timestamp TIMESTAMPTZ NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Create dao_admins table
-- ============================================================
CREATE TABLE IF NOT EXISTS dao_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  wallet_address VARCHAR(44),
  created_by INTEGER REFERENCES dao_admins(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- ============================================================
-- 3. Create dao_trait_rewards table
-- ============================================================
CREATE TABLE IF NOT EXISTS dao_trait_rewards (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  trait_type VARCHAR(100) NOT NULL,
  trait_value VARCHAR(100) NOT NULL,
  token_address VARCHAR(44) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  token_decimals INTEGER DEFAULT 9,
  multiplier DECIMAL(18, 9) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Create dao_airdrop_configs table
-- ============================================================
CREATE TABLE IF NOT EXISTS dao_airdrop_configs (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  airdrop_type VARCHAR(20) NOT NULL CHECK (airdrop_type IN ('threshold', 'trait')),
  token_address VARCHAR(100) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  token_decimals INTEGER NOT NULL DEFAULT 9,
  amount_per_nft NUMERIC(20, 9) NOT NULL,
  minimum_threshold INTEGER,
  trait_type VARCHAR(100),
  trait_value VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'expired')),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Create dao_airdrop_snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS dao_airdrop_snapshots (
  id SERIAL PRIMARY KEY,
  dao_airdrop_config_id INTEGER NOT NULL REFERENCES dao_airdrop_configs(id) ON DELETE CASCADE,
  wallet_address VARCHAR(44) NOT NULL,
  token_amount NUMERIC(20, 9) NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  claim_tx_hash VARCHAR(88),
  UNIQUE(dao_airdrop_config_id, wallet_address)
);

-- ============================================================
-- 6. Insert DAO settings (skip if already present)
-- ============================================================
INSERT INTO settings (key_name, value, description)
VALUES
  ('dao_rewards_wallet', '', 'DAO reward distribution wallet address'),
  ('dao_rewards_wallet_encrypted_key', '', 'Encrypted private key for DAO rewards wallet'),
  ('dao_claim_fee', '0', 'DAO claim fee in SOL (0 = free)')
ON CONFLICT (key_name) DO NOTHING;

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staked_nfts_dao_claim
  ON staked_nfts(owner_wallet, dao_last_claim_timestamp);

CREATE INDEX IF NOT EXISTS idx_dao_trait_rewards_collection
  ON dao_trait_rewards(collection_id);

CREATE INDEX IF NOT EXISTS idx_dao_trait_rewards_active
  ON dao_trait_rewards(is_active);

CREATE INDEX IF NOT EXISTS idx_dao_airdrop_configs_collection
  ON dao_airdrop_configs(collection_id);

CREATE INDEX IF NOT EXISTS idx_dao_airdrop_configs_status
  ON dao_airdrop_configs(status);

CREATE INDEX IF NOT EXISTS idx_dao_airdrop_snapshots_config
  ON dao_airdrop_snapshots(dao_airdrop_config_id);

CREATE INDEX IF NOT EXISTS idx_dao_airdrop_snapshots_wallet
  ON dao_airdrop_snapshots(wallet_address);

CREATE INDEX IF NOT EXISTS idx_dao_airdrop_snapshots_claimed
  ON dao_airdrop_snapshots(is_claimed);
