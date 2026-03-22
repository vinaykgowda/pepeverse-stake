/**
 * Tests for Network Configuration Module
 */

describe('NetworkConfig', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear the module cache to get a fresh instance
    jest.resetModules();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Initialization', () => {
    test('should initialize successfully with all required environment variables', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      const networkConfig = require('./network');
      
      expect(networkConfig.getPrimaryRpc()).toBe('https://api.mainnet-beta.solana.com');
      expect(networkConfig.getFallbackRpc()).toBe('https://solana-api.projectserum.com');
      expect(networkConfig.getHeliusEndpoint()).toBe('https://mainnet.helius-rpc.com');
      expect(networkConfig.getNetwork()).toBe('mainnet');
    });
    
    test('should throw error when MAINNET_RPC_PRIMARY is missing', () => {
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      
      expect(() => {
        require('./network');
      }).toThrow('Missing required network configuration: MAINNET_RPC_PRIMARY');
    });
    
    test('should throw error when MAINNET_RPC_FALLBACK is missing', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      
      expect(() => {
        require('./network');
      }).toThrow('Missing required network configuration: MAINNET_RPC_FALLBACK');
    });
    
    test('should throw error when HELIUS_MAINNET_ENDPOINT is missing', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      
      expect(() => {
        require('./network');
      }).toThrow('Missing required network configuration: HELIUS_MAINNET_ENDPOINT');
    });
    
    test('should throw error when multiple environment variables are missing', () => {
      expect(() => {
        require('./network');
      }).toThrow('Missing required network configuration');
    });
    
    test('should default to mainnet when SOLANA_NETWORK is not set', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      delete process.env.SOLANA_NETWORK;
      
      const networkConfig = require('./network');
      
      expect(networkConfig.getNetwork()).toBe('mainnet');
    });
    
    test('should warn when SOLANA_NETWORK is not mainnet', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'devnet';
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      require('./network');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SOLANA_NETWORK is set to "devnet" but should be "mainnet"')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('RPC Endpoints', () => {
    let networkConfig;
    
    beforeEach(() => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      networkConfig = require('./network');
    });
    
    test('should return primary RPC endpoint', () => {
      expect(networkConfig.getPrimaryRpc()).toBe('https://api.mainnet-beta.solana.com');
    });
    
    test('should return fallback RPC endpoint', () => {
      expect(networkConfig.getFallbackRpc()).toBe('https://solana-api.projectserum.com');
    });
    
    test('should return Helius endpoint', () => {
      expect(networkConfig.getHeliusEndpoint()).toBe('https://mainnet.helius-rpc.com');
    });
  });
  
  describe('Explorer URLs', () => {
    let networkConfig;
    
    beforeEach(() => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      networkConfig = require('./network');
    });
    
    test('should return explorer base URL', () => {
      expect(networkConfig.getExplorerUrl()).toBe('https://explorer.solana.com');
    });
    
    test('should generate transaction URL', () => {
      const signature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
      const url = networkConfig.getTransactionUrl(signature);
      
      expect(url).toBe(`https://explorer.solana.com/tx/${signature}`);
    });
    
    test('should generate address URL', () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const url = networkConfig.getAddressUrl(address);
      
      expect(url).toBe(`https://explorer.solana.com/address/${address}`);
    });
  });
  
  describe('Network Checks', () => {
    test('should return true for isMainnet when network is mainnet', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      const networkConfig = require('./network');
      
      expect(networkConfig.isMainnet()).toBe(true);
    });
    
    test('should return false for isMainnet when network is not mainnet', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'devnet';
      
      jest.spyOn(console, 'warn').mockImplementation();
      const networkConfig = require('./network');
      
      expect(networkConfig.isMainnet()).toBe(false);
    });
  });
  
  describe('getConfig', () => {
    test('should return complete configuration object', () => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      const networkConfig = require('./network');
      const config = networkConfig.getConfig();
      
      expect(config).toEqual({
        network: 'mainnet',
        rpc: {
          primary: 'https://api.mainnet-beta.solana.com',
          fallback: 'https://solana-api.projectserum.com'
        },
        helius: {
          endpoint: 'https://mainnet.helius-rpc.com'
        },
        explorer: {
          baseUrl: 'https://explorer.solana.com'
        }
      });
    });
  });
  
  describe('validateConnectivity', () => {
    let networkConfig;
    
    beforeEach(() => {
      process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
      process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';
      process.env.HELIUS_MAINNET_ENDPOINT = 'https://mainnet.helius-rpc.com';
      process.env.SOLANA_NETWORK = 'mainnet';
      
      networkConfig = require('./network');
    });
    
    test('should validate connectivity successfully when all endpoints are healthy', async () => {
      // Mock successful responses
      const mockConnection = {
        getSlot: jest.fn().mockResolvedValue(123456)
      };
      
      jest.mock('@solana/web3.js', () => ({
        Connection: jest.fn(() => mockConnection)
      }));
      
      const axios = require('axios');
      jest.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
      
      const results = await networkConfig.validateConnectivity();
      
      expect(results.primaryRpc.status).toBe('healthy');
      expect(results.fallbackRpc.status).toBe('healthy');
      expect(results.helius.status).toBe('healthy');
    });
    
    test('should throw error when all RPC endpoints are unhealthy', async () => {
      // Mock failed responses
      const mockConnection = {
        getSlot: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      
      jest.mock('@solana/web3.js', () => ({
        Connection: jest.fn(() => mockConnection)
      }));
      
      await expect(networkConfig.validateConnectivity()).rejects.toThrow(
        'CRITICAL: No healthy RPC endpoints available'
      );
    });
    
    test('should succeed when only fallback RPC is healthy', async () => {
      // Mock primary failing, fallback succeeding
      let callCount = 0;
      const mockConnection = {
        getSlot: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Primary failed'));
          }
          return Promise.resolve(123456);
        })
      };
      
      jest.mock('@solana/web3.js', () => ({
        Connection: jest.fn(() => mockConnection)
      }));
      
      const axios = require('axios');
      jest.spyOn(axios, 'post').mockResolvedValue({ status: 200 });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const results = await networkConfig.validateConnectivity();
      
      expect(results.primaryRpc.status).toBe('unhealthy');
      expect(results.fallbackRpc.status).toBe('healthy');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary RPC endpoint is unhealthy')
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should warn when Helius endpoint is unhealthy but not fail', async () => {
      // Mock RPC succeeding, Helius failing
      const mockConnection = {
        getSlot: jest.fn().mockResolvedValue(123456)
      };
      
      jest.mock('@solana/web3.js', () => ({
        Connection: jest.fn(() => mockConnection)
      }));
      
      const axios = require('axios');
      jest.spyOn(axios, 'post').mockRejectedValue(new Error('Helius failed'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const results = await networkConfig.validateConnectivity();
      
      expect(results.helius.status).toBe('unhealthy');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Helius endpoint is unhealthy')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
