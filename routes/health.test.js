/**
 * Health Check Endpoint Tests
 * 
 * Tests for the /health endpoint to ensure proper health monitoring.
 * 
 * Requirements: 34.1, 34.2, 34.3
 */

// Mock dependencies BEFORE importing modules that use them
jest.mock('../src/config/database', () => ({
  healthCheck: jest.fn()
}));

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn()
}));

jest.mock('../src/config/network', () => ({
  getPrimaryRpc: jest.fn(),
  getFallbackRpc: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const healthRoutes = require('./health');
const db = require('../src/config/database');
const { Connection } = require('@solana/web3.js');
const networkConfig = require('../src/config/network');

describe('Health Check Endpoint', () => {
  let app;
  
  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use('/', healthRoutes);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    networkConfig.getPrimaryRpc = jest.fn().mockReturnValue('https://api.mainnet-beta.solana.com');
    networkConfig.getFallbackRpc = jest.fn().mockReturnValue('https://solana-api.projectserum.com');
  });
  
  describe('GET /health', () => {
    test('should return 200 when all systems are healthy', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        checks: {
          database: 'healthy',
          solana_rpc: 'healthy'
        }
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.details.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(response.body.details.solana_rpc.responseTime).toBeGreaterThanOrEqual(0);
    });
    
    test('should return 503 when database is unhealthy', async () => {
      // Mock unhealthy database
      db.healthCheck = jest.fn().mockResolvedValue(false);
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: {
          database: 'unhealthy',
          solana_rpc: 'healthy'
        }
      });
    });
    
    test('should return 503 when database throws error', async () => {
      // Mock database error
      db.healthCheck = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: {
          database: 'unhealthy',
          solana_rpc: 'healthy'
        }
      });
      expect(response.body.details.database.error).toBe('Connection timeout');
    });
    
    test('should return 503 when RPC is unhealthy', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock unhealthy RPC (both primary and fallback)
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockRejectedValue(new Error('RPC connection failed'))
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: {
          database: 'healthy',
          solana_rpc: 'unhealthy'
        }
      });
      expect(response.body.details.solana_rpc.error).toBe('RPC connection failed');
    });
    
    test('should use fallback RPC when primary fails', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock primary RPC failure, fallback success
      let callCount = 0;
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Primary RPC failed'));
          }
          return Promise.resolve({
            blockhash: 'test-blockhash',
            feeCalculator: { lamportsPerSignature: 5000 }
          });
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        checks: {
          database: 'healthy',
          solana_rpc: 'healthy'
        }
      });
      expect(response.body.details.solana_rpc.note).toBe('Using fallback RPC');
      expect(networkConfig.getFallbackRpc).toHaveBeenCalled();
    });
    
    test('should return 503 when both database and RPC are unhealthy', async () => {
      // Mock unhealthy database
      db.healthCheck = jest.fn().mockResolvedValue(false);
      
      // Mock unhealthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockRejectedValue(new Error('RPC connection failed'))
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: {
          database: 'unhealthy',
          solana_rpc: 'unhealthy'
        }
      });
    });
    
    test('should include response times in details', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.details.database).toHaveProperty('responseTime');
      expect(response.body.details.solana_rpc).toHaveProperty('responseTime');
      expect(typeof response.body.details.database.responseTime).toBe('number');
      expect(typeof response.body.details.solana_rpc.responseTime).toBe('number');
    });
    
    test('should include RPC endpoint in details', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.details.solana_rpc.endpoint).toBe('https://api.mainnet-beta.solana.com');
    });
    
    test('should include timestamp in ISO 8601 format', async () => {
      // Mock healthy database
      db.healthCheck = jest.fn().mockResolvedValue(true);
      
      // Mock healthy RPC
      const mockConnection = {
        getRecentBlockhash: jest.fn().mockResolvedValue({
          blockhash: 'test-blockhash',
          feeCalculator: { lamportsPerSignature: 5000 }
        })
      };
      Connection.mockImplementation(() => mockConnection);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
