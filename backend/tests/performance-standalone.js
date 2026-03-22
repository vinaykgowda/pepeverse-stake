/**
 * Standalone Performance Test Script
 * 
 * This script can be run independently to test the performance of a running
 * backend server. It simulates 50 concurrent users making requests and
 * measures response times.
 * 
 * Requirements: 38.1
 * 
 * Usage:
 *   node backend/tests/performance-standalone.js [server-url]
 * 
 * Example:
 *   node backend/tests/performance-standalone.js http://localhost:3000
 *   node backend/tests/performance-standalone.js https://your-app.vercel.app
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const DEFAULT_SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CONCURRENT_USERS = 50;
const TEST_ENDPOINT = '/health';

/**
 * Make an HTTP/HTTPS request and measure response time
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        resolve({
          status: res.statusCode,
          responseTime,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      reject({
        error: error.message,
        responseTime
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        responseTime: 10000
      });
    });
    
    req.end();
  });
}

/**
 * Calculate statistics from response times
 */
function calculateStats(responseTimes) {
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const total = responseTimes.reduce((sum, time) => sum + time, 0);
  const average = total / responseTimes.length;
  const min = Math.min(...responseTimes);
  const max = Math.max(...responseTimes);
  
  // Percentiles
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  
  // Standard deviation
  const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / responseTimes.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    total: responseTimes.length,
    average,
    min,
    max,
    p50,
    p75,
    p90,
    p95,
    p99,
    stdDev
  };
}

/**
 * Run the performance test
 */
async function runPerformanceTest(serverUrl) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Performance Test: Concurrent Requests             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Server URL: ${serverUrl}`);
  console.log(`Test Endpoint: ${TEST_ENDPOINT}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`\nStarting test...\n`);
  
  const testUrl = `${serverUrl}${TEST_ENDPOINT}`;
  const responseTimes = [];
  const errors = [];
  const statusCodes = {};
  
  const startTime = Date.now();
  
  // Create concurrent requests
  const requests = Array(CONCURRENT_USERS).fill(null).map(async (_, index) => {
    try {
      const result = await makeRequest(testUrl);
      responseTimes.push(result.responseTime);
      
      // Track status codes
      statusCodes[result.status] = (statusCodes[result.status] || 0) + 1;
      
      return result;
    } catch (error) {
      errors.push(error);
      if (error.responseTime) {
        responseTimes.push(error.responseTime);
      }
      return null;
    }
  });
  
  // Wait for all requests to complete
  const results = await Promise.all(requests);
  const totalTime = Date.now() - startTime;
  
  // Calculate statistics
  const stats = calculateStats(responseTimes);
  const successfulRequests = results.filter(r => r !== null).length;
  const failedRequests = errors.length;
  
  // Print results
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      Test Results                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Request Summary:');
  console.log(`  Total Requests:      ${CONCURRENT_USERS}`);
  console.log(`  Successful:          ${successfulRequests} (${((successfulRequests/CONCURRENT_USERS)*100).toFixed(1)}%)`);
  console.log(`  Failed:              ${failedRequests} (${((failedRequests/CONCURRENT_USERS)*100).toFixed(1)}%)`);
  console.log(`  Total Test Time:     ${totalTime}ms`);
  
  console.log('\nStatus Code Distribution:');
  Object.entries(statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count} requests`);
  });
  
  if (responseTimes.length > 0) {
    console.log('\nResponse Time Statistics (ms):');
    console.log(`  Average:             ${stats.average.toFixed(2)}`);
    console.log(`  Min:                 ${stats.min}`);
    console.log(`  Max:                 ${stats.max}`);
    console.log(`  Standard Deviation:  ${stats.stdDev.toFixed(2)}`);
    
    console.log('\nPercentiles (ms):');
    console.log(`  P50 (Median):        ${stats.p50}`);
    console.log(`  P75:                 ${stats.p75}`);
    console.log(`  P90:                 ${stats.p90}`);
    console.log(`  P95:                 ${stats.p95}`);
    console.log(`  P99:                 ${stats.p99}`);
    
    console.log('\nPerformance Analysis:');
    
    // Check requirement 38.1
    const meetsRequirement = stats.average < 500;
    console.log(`  Requirement 38.1:    ${meetsRequirement ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`    (Average < 500ms)  ${stats.average.toFixed(2)}ms`);
    
    // Additional quality metrics
    const under500ms = responseTimes.filter(t => t < 500).length;
    const under1000ms = responseTimes.filter(t => t < 1000).length;
    console.log(`\n  Requests < 500ms:    ${under500ms} (${((under500ms/responseTimes.length)*100).toFixed(1)}%)`);
    console.log(`  Requests < 1000ms:   ${under1000ms} (${((under1000ms/responseTimes.length)*100).toFixed(1)}%)`);
    
    // Throughput
    const throughput = (CONCURRENT_USERS / totalTime) * 1000;
    console.log(`\n  Throughput:          ${throughput.toFixed(2)} req/s`);
  }
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 5).forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.error}`);
    });
    if (errors.length > 5) {
      console.log(`  ... and ${errors.length - 5} more errors`);
    }
  }
  
  console.log('\n╚════════════════════════════════════════════════════════════╝\n');
  
  // Exit with appropriate code
  if (stats.average >= 500) {
    console.log('❌ Performance test FAILED: Average response time exceeds 500ms\n');
    process.exit(1);
  } else if (failedRequests > CONCURRENT_USERS * 0.05) {
    console.log('⚠️  Performance test WARNING: More than 5% of requests failed\n');
    process.exit(1);
  } else {
    console.log('✅ Performance test PASSED: All requirements met\n');
    process.exit(0);
  }
}

// Main execution
const serverUrl = process.argv[2] || DEFAULT_SERVER_URL;

// Validate URL
try {
  new URL(serverUrl);
} catch (error) {
  console.error(`Error: Invalid server URL: ${serverUrl}`);
  console.error('Usage: node performance-standalone.js [server-url]');
  console.error('Example: node performance-standalone.js http://localhost:3000');
  process.exit(1);
}

// Run the test
runPerformanceTest(serverUrl).catch(error => {
  console.error('\nFatal error running performance test:');
  console.error(error);
  process.exit(1);
});
