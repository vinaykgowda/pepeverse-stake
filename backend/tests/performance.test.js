/**
 * Performance Test: Concurrent Request Handling
 * 
 * Tests that the backend can handle 50 concurrent requests with average
 * response time under 500ms.
 * 
 * Requirements: 38.1
 * 
 * This test simulates 50 concurrent users making requests to the API
 * and measures response times to ensure the backend meets performance
 * requirements.
 */

const request = require('supertest');
const express = require('express');

// Mock the database and external dependencies
jest.mock('../src/db', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] })
  }))
}));

jest.mock('../src/config/database', () => ({
  healthCheck: jest.fn().mockResolvedValue(true),
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

jest.mock('../src/config/network', () => ({
  validateConnectivity: jest.fn().mockResolvedValue({
    primaryRpc: { status: 'healthy' },
    fallbackRpc: { status: 'healthy' },
    helius: { status: 'healthy' }
  }),
  getPrimaryRpc: jest.fn(() => 'https://api.mainnet-beta.solana.com'),
  getFallbackRpc: jest.fn(() => 'https://solana-api.projectserum.com')
}));

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getRecentBlockhash: jest.fn().mockResolvedValue({
      blockhash: 'mock-blockhash',
      feeCalculator: { lamportsPerSignature: 5000 }
    })
  }))
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Set required environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.API_BASE_URL = '/api';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.MAINNET_RPC_PRIMARY = 'https://api.mainnet-beta.solana.com';
process.env.MAINNET_RPC_FALLBACK = 'https://solana-api.projectserum.com';

describe('Performance Test: Concurrent Request Handling', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Add health endpoint
    const healthRoutes = require('../routes/health');
    app.use('/', healthRoutes);
  });

  /**
   * Test: 50 Concurrent Requests
   * 
   * Validates Requirement 38.1:
   * Backend handles 50 concurrent requests with average response time under 500ms
   */
  test('should handle 50 concurrent requests with average response time under 500ms', async () => {
    const concurrentUsers = 50;
    const responseTimes = [];
    
    // Create an array of promises for concurrent requests
    const requests = Array(concurrentUsers).fill(null).map(async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      responseTimes.push(responseTime);
      
      return {
        status: response.status,
        responseTime
      };
    });
    
    // Execute all requests concurrently
    const results = await Promise.all(requests);
    
    // Calculate statistics
    const totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0);
    const averageResponseTime = totalResponseTime / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    // Calculate percentiles
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    // Log performance metrics
    console.log('\n=== Performance Test Results ===');
    console.log(`Total Requests: ${concurrentUsers}`);
    console.log(`Successful Requests: ${results.filter(r => r.status === 200 || r.status === 503).length}`);
    console.log(`\nResponse Time Statistics (ms):`);
    console.log(`  Average: ${averageResponseTime.toFixed(2)}`);
    console.log(`  Min: ${minResponseTime}`);
    console.log(`  Max: ${maxResponseTime}`);
    console.log(`  Median (P50): ${p50}`);
    console.log(`  P95: ${p95}`);
    console.log(`  P99: ${p99}`);
    console.log('================================\n');
    
    // Assertions
    expect(results.length).toBe(concurrentUsers);
    
    // All requests should return either 200 (healthy) or 503 (degraded)
    results.forEach(result => {
      expect([200, 503]).toContain(result.status);
    });
    
    // Requirement 38.1: Average response time should be under 500ms
    expect(averageResponseTime).toBeLessThan(500);
    
    // Additional quality checks
    // At least 95% of requests should complete within 1 second
    const requestsUnder1s = responseTimes.filter(time => time < 1000).length;
    const percentageUnder1s = (requestsUnder1s / responseTimes.length) * 100;
    expect(percentageUnder1s).toBeGreaterThanOrEqual(95);
  }, 30000); // 30 second timeout for the test

  /**
   * Test: Response Time Consistency
   * 
   * Validates that response times are consistent across multiple
   * concurrent requests (low variance).
   */
  test('should maintain consistent response times under load', async () => {
    const concurrentUsers = 50;
    const responseTimes = [];
    
    const requests = Array(concurrentUsers).fill(null).map(async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      return responseTime;
    });
    
    await Promise.all(requests);
    
    // Calculate standard deviation
    const mean = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / responseTimes.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / mean) * 100;
    
    console.log('\n=== Response Time Consistency ===');
    console.log(`Mean: ${mean.toFixed(2)}ms`);
    console.log(`Standard Deviation: ${stdDev.toFixed(2)}ms`);
    console.log(`Coefficient of Variation: ${coefficientOfVariation.toFixed(2)}%`);
    console.log('=================================\n');
    
    // Coefficient of variation should be reasonable (< 100% means stdDev < mean)
    expect(coefficientOfVariation).toBeLessThan(100);
  }, 30000);

  /**
   * Test: Sustained Load
   * 
   * Tests that the backend can handle sustained concurrent load
   * over multiple rounds.
   */
  test('should handle sustained concurrent load over multiple rounds', async () => {
    const rounds = 3;
    const usersPerRound = 20;
    const allResponseTimes = [];
    
    for (let round = 0; round < rounds; round++) {
      const requests = Array(usersPerRound).fill(null).map(async () => {
        const startTime = Date.now();
        await request(app).get('/health');
        const responseTime = Date.now() - startTime;
        allResponseTimes.push(responseTime);
        return responseTime;
      });
      
      await Promise.all(requests);
      
      // Small delay between rounds
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const averageResponseTime = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
    
    console.log('\n=== Sustained Load Test ===');
    console.log(`Total Rounds: ${rounds}`);
    console.log(`Users per Round: ${usersPerRound}`);
    console.log(`Total Requests: ${allResponseTimes.length}`);
    console.log(`Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
    console.log('===========================\n');
    
    // Average should still be under 500ms
    expect(averageResponseTime).toBeLessThan(500);
  }, 30000);
});
