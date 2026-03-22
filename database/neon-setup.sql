-- NeonDB Setup Script for Pepeverse Staking Platform
-- Run this script in your NeonDB SQL Editor or via psql

-- IMPORTANT: Update your DATABASE_URL in Vercel to use sslmode=verify-full:
-- postgresql://user:pass@host.neon.tech/db?sslmode=verify-full

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS trait_rewards CASCADE;
DROP TABLE IF EXISTS collection_rewards CASCADE;
DROP TABLE IF EXISTS staked_nfts CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;

-- Create admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    wallet_address VARCHAR(44),
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Create collections table
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    creator_address VARCHAR(44) NOT NULL,
    hashlist TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    stake_fee DECIMAL(18, 9) DEFAULT 0,
    unstake_fee DECIMAL(18, 9) DEFAULT 0,
    claim_fee DECIMAL(18, 9) DEFAULT 0.001,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create staked_nfts table
CREATE TABLE staked_nfts (
    id SERIAL PRIMARY KEY,
    mint_address VARCHAR(44) NOT NULL UNIQUE,
    collection_id INTEGER NOT NULL,
    owner_wallet VARCHAR(44) NOT NULL,
    stake_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    traits JSONB,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Create collection_rewards table
CREATE TABLE collection_rewards (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL,
    token_address VARCHAR(44) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_decimals INTEGER DEFAULT 9,
    daily_rate DECIMAL(18, 9) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Create trait_rewards table
CREATE TABLE trait_rewards (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER NOT NULL,
    trait_type VARCHAR(100) NOT NULL,
    trait_value VARCHAR(100) NOT NULL,
    token_address VARCHAR(44) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    multiplier DECIMAL(8, 4) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Create settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('STAKE', 'UNSTAKE', 'CLAIM', 'FEE')),
    transaction_hash VARCHAR(88),
    amount DECIMAL(18, 9),
    token_address VARCHAR(44),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_staked_nfts_owner ON staked_nfts(owner_wallet);
CREATE INDEX idx_staked_nfts_collection ON staked_nfts(collection_id);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_address);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_rewards_updated_at BEFORE UPDATE ON collection_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trait_rewards_updated_at BEFORE UPDATE ON trait_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial settings
INSERT INTO settings (key_name, value, description) VALUES
('rewards_wallet', '', 'Wallet address for distributing rewards and collecting fees'),
('rewards_wallet_encrypted_key', '', 'Encrypted private key of rewards wallet'),
('staking_active', 'true', 'Whether staking is currently active'),
('minimum_claim_amount', '1', 'Minimum amount required to claim rewards');

-- Insert initial super admin
-- Default password: 'admin123' (hashed with bcrypt)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO admins (username, password, email, is_super_admin) VALUES
('admin', '$2b$10$NYPFM7NzbFtrFR.8J0xG0.tpOzs.A7j/OKIeX6rkKfpJGV4KzFAou', 'admin@pepeverse.com', true);

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
