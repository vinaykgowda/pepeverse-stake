/**
 * Health Check Endpoint
 * 
 * Provides system health status for monitoring and load balancers.
 * Checks database connectivity and Solana RPC connectivity.
 * 
 * Requirements: 34.1, 34.2, 34.3
 */

const express = require('express');
const router = express.Router();
const db = require('../src/config/database');
const { Connection } = require('@solana/web3.js');
const networkConfig = require('../src/config/network');

/**
 * GET /health
 * 
 * Returns health status of the service and its dependencies.
 * 
 * Response codes:
 * - 200: All systems healthy
 * - 503: One or more systems degraded
 * 
 * Response format:
 * {
 *   status: 'healthy' | 'degraded',
 *   timestamp: ISO 8601 timestamp,
 *   checks: {
 *     database: 'healthy' | 'unhealthy',
 *     solana_rpc: 'healthy' | 'unhealthy'
 *   },
 *   details: {
 *     database: { responseTime: number },
 *     solana_rpc: { responseTime: number, endpoint: string }
 *   }
 * }
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    details: {}
  };
  
  // Check database connectivity
  const dbStart = Date.now();
  try {
    const isHealthy = await db.healthCheck();
    const dbResponseTime = Date.now() - dbStart;
    
    health.checks.database = isHealthy ? 'healthy' : 'unhealthy';
    health.details.database = {
      responseTime: dbResponseTime
    };
    
    if (!isHealthy) {
      health.status = 'degraded';
    }
  } catch (error) {
    const dbResponseTime = Date.now() - dbStart;
    health.checks.database = 'unhealthy';
    health.details.database = {
      responseTime: dbResponseTime,
      error: error.message
    };
    health.status = 'degraded';
  }
  
  // Check Solana RPC connectivity
  const rpcStart = Date.now();
  try {
    const primaryRpc = networkConfig.getPrimaryRpc();
    const connection = new Connection(primaryRpc, 'confirmed');
    
    // Try to get recent blockhash as a connectivity test
    await connection.getRecentBlockhash();
    const rpcResponseTime = Date.now() - rpcStart;
    
    health.checks.solana_rpc = 'healthy';
    health.details.solana_rpc = {
      responseTime: rpcResponseTime,
      endpoint: primaryRpc
    };
  } catch (error) {
    const rpcResponseTime = Date.now() - rpcStart;
    
    // Try fallback RPC
    try {
      const fallbackRpc = networkConfig.getFallbackRpc();
      const fallbackConnection = new Connection(fallbackRpc, 'confirmed');
      await fallbackConnection.getRecentBlockhash();
      const fallbackResponseTime = Date.now() - rpcStart;
      
      health.checks.solana_rpc = 'healthy';
      health.details.solana_rpc = {
        responseTime: fallbackResponseTime,
        endpoint: fallbackRpc,
        note: 'Using fallback RPC'
      };
    } catch (fallbackError) {
      health.checks.solana_rpc = 'unhealthy';
      health.details.solana_rpc = {
        responseTime: rpcResponseTime,
        error: fallbackError.message
      };
      health.status = 'degraded';
    }
  }
  
  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
