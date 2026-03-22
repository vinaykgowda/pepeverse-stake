-- database/schema.sql

-- Drop existing tables if they exist
DROP TABLE IF EXISTS trait_rewards;
DROP TABLE IF EXISTS collection_rewards;
DROP TABLE IF EXISTS staked_nfts;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS transactions;

CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Will store hashed password
    email VARCHAR(100) UNIQUE,
    wallet_address VARCHAR(44), -- Optional, no longer required
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);


-- Create collections table with claim_fee column
CREATE TABLE collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    creator_address VARCHAR(44) NOT NULL, -- Added creator_address field
    hashlist TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    stake_fee DECIMAL(18, 9) DEFAULT 0,
    unstake_fee DECIMAL(18, 9) DEFAULT 0,
    claim_fee DECIMAL(18, 9) DEFAULT 0.001, -- Added claim_fee field
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create staked_nfts table
CREATE TABLE staked_nfts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mint_address VARCHAR(44) NOT NULL UNIQUE,
    collection_id INT NOT NULL,
    owner_wallet VARCHAR(44) NOT NULL,
    stake_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    traits JSON,
    FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Create collection_rewards table for base rewards per collection
CREATE TABLE collection_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_id INT NOT NULL,
    token_address VARCHAR(44) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_decimals INT DEFAULT 9,
    daily_rate DECIMAL(18, 9) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Create trait_rewards table for trait-based rewards
CREATE TABLE trait_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_id INT NOT NULL,
    trait_type VARCHAR(100) NOT NULL,
    trait_value VARCHAR(100) NOT NULL,
    token_address VARCHAR(44) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    multiplier DECIMAL(8, 4) DEFAULT 1.0, -- Multiplier applied to base rate
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Create settings table
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    transaction_type ENUM('STAKE', 'UNSTAKE', 'CLAIM', 'FEE') NOT NULL,
    transaction_hash VARCHAR(88), -- Solana transaction signatures are 88 chars
    amount DECIMAL(18, 9),
    token_address VARCHAR(44),
    status ENUM('PENDING', 'CONFIRMED', 'FAILED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert initial settings (removed claim_fee as it's now collection-specific)
INSERT INTO settings (key_name, value, description) VALUES
('rewards_wallet', '', 'Wallet address for distributing rewards and collecting fees'),
('rewards_wallet_encrypted_key', '', 'Encrypted private key of rewards wallet'),
('staking_active', 'true', 'Whether staking is currently active'),
('minimum_claim_amount', '1', 'Minimum amount required to claim rewards');

-- Insert initial super admin with password
INSERT INTO admins (username, password, email, is_super_admin) VALUES
('admin', '$2b$10$NYPFM7NzbFtrFR.8J0xG0.tpOzs.A7j/OKIeX6rkKfpJGV4KzFAou', 'heyvkg@gmail.com', true);