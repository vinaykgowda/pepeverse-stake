/**
 * Tests for Startup Validation Module
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5, 28.1, 28.2, 28.3
 */

const { validateEnvironment, REQUIRED_ENV_VARS } = require('./startup-validation');

describe('Startup Validation', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('validateEnvironment', () => {
    test('should pass when all required variables are set', () => {
      // Set all required environment variables
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'a'.repeat(32); // 32 characters minimum
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should fail when DATABASE_URL is missing', () => {
      // Set all except DATABASE_URL
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('DATABASE_URL');
    });
    
    test('should fail when JWT_SECRET is missing', () => {
      // Set all except JWT_SECRET
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('JWT_SECRET');
    });
    
    test('should fail when JWT_SECRET is too short', () => {
      // Set all with short JWT_SECRET
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'short'; // Less than 32 characters
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('JWT_SECRET');
    });
    
    test('should fail when HELIUS_API_KEY is missing', () => {
      // Set all except HELIUS_API_KEY
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('HELIUS_API_KEY');
    });
    
    test('should fail when PORT is invalid', () => {
      // Set all with invalid PORT
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = 'not-a-number';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('PORT');
    });
    
    test('should fail when RPC endpoints have invalid format', () => {
      // Set all with invalid RPC endpoint
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.MAINNET_RPC_PRIMARY = 'not-a-url'; // Invalid URL
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('MAINNET_RPC_PRIMARY');
    });
    
    test('should fail when multiple variables are missing', () => {
      // Set only a few variables
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
    
    test('should set defaults for optional variables', () => {
      // Set all required variables
      process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db?sslmode=require';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.HELIUS_API_KEY = 'test-api-key';
      process.env.REWARDS_WALLET_PRIVATE_KEY = 'test-private-key';
      process.env.PORT = '3000';
      process.env.API_BASE_URL = '/api';
      
      // Don't set optional variables
      delete process.env.NODE_ENV;
      delete process.env.SOLANA_NETWORK;
      
      const result = validateEnvironment();
      
      expect(result.valid).toBe(true);
      expect(process.env.NODE_ENV).toBe('development');
      expect(process.env.SOLANA_NETWORK).toBe('mainnet');
    });
  });
  
  describe('Required variables list', () => {
    test('should include all critical secrets', () => {
      const requiredKeys = Object.keys(REQUIRED_ENV_VARS);
      
      expect(requiredKeys).toContain('DATABASE_URL');
      expect(requiredKeys).toContain('JWT_SECRET');
      expect(requiredKeys).toContain('HELIUS_API_KEY');
      expect(requiredKeys).toContain('REWARDS_WALLET_PRIVATE_KEY');
    });
    
    test('should include all network configuration', () => {
      const requiredKeys = Object.keys(REQUIRED_ENV_VARS);
      
      expect(requiredKeys).toContain('MAINNET_RPC_PRIMARY');
      expect(requiredKeys).toContain('MAINNET_RPC_FALLBACK');
      expect(requiredKeys).toContain('HELIUS_MAINNET_ENDPOINT');
    });
    
    test('should include server configuration', () => {
      const requiredKeys = Object.keys(REQUIRED_ENV_VARS);
      
      expect(requiredKeys).toContain('PORT');
      expect(requiredKeys).toContain('API_BASE_URL');
    });
  });
});
