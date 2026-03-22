# Performance Testing Guide

This directory contains performance tests for the Solana NFT Staking Platform backend, specifically designed to validate **Requirement 38.1**: Backend handles 50 concurrent requests with average response time under 500ms.

## Test Files

### 1. `performance.test.js` - Jest-based Performance Tests

Integrated performance tests that run with the Jest test suite. These tests use mocked dependencies for consistent, isolated testing.

**Features:**
- Tests 50 concurrent requests with response time validation
- Measures response time consistency (standard deviation)
- Tests sustained load over multiple rounds
- Provides detailed performance metrics and percentiles

**Run with:**
```bash
npm test performance.test.js
```

**Output includes:**
- Total requests and success rate
- Response time statistics (average, min, max, median)
- Percentiles (P50, P95, P99)
- Coefficient of variation for consistency

### 2. `performance-standalone.js` - Standalone Performance Test

Independent script that tests a running server instance. Use this for testing deployed environments or local development servers.

**Features:**
- Tests real server endpoints (no mocking)
- Simulates 50 concurrent users
- Comprehensive performance metrics
- Visual output with pass/fail indicators
- Exit codes for CI/CD integration

**Run with:**
```bash
# Test local development server
node backend/tests/performance-standalone.js http://localhost:3000

# Test staging environment
node backend/tests/performance-standalone.js https://staging.yourdomain.com

# Test production (use with caution)
node backend/tests/performance-standalone.js https://yourdomain.com
```

**Environment variable:**
```bash
SERVER_URL=http://localhost:3000 node backend/tests/performance-standalone.js
```

## Performance Requirements

### Requirement 38.1: Concurrent Request Handling

**Specification:**
- Backend SHALL handle 50 concurrent requests
- Average response time SHALL be under 500ms
- At least 95% of requests should complete within 1 second

**Test Endpoint:**
- `/health` - Health check endpoint that validates database and RPC connectivity

**Success Criteria:**
- ✅ Average response time < 500ms
- ✅ All requests return valid status codes (200 or 503)
- ✅ At least 95% of requests complete within 1 second
- ✅ Less than 5% request failure rate

## Understanding the Results

### Response Time Metrics

- **Average**: Mean response time across all requests (must be < 500ms)
- **Min/Max**: Fastest and slowest response times
- **Standard Deviation**: Measure of response time consistency (lower is better)
- **Percentiles**:
  - **P50 (Median)**: 50% of requests completed faster than this
  - **P95**: 95% of requests completed faster than this
  - **P99**: 99% of requests completed faster than this

### Example Output

```
=== Performance Test Results ===
Total Requests: 50
Successful Requests: 50

Response Time Statistics (ms):
  Average: 245.32
  Min: 180
  Max: 420
  Median (P50): 240
  P95: 380
  P99: 410
================================

✅ PASS: Average response time (245.32ms) is under 500ms
```

## Running Performance Tests

### Local Development

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **In another terminal, run the standalone test:**
   ```bash
   node backend/tests/performance-standalone.js http://localhost:3000
   ```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Performance Tests
  run: |
    npm start &
    sleep 5
    node backend/tests/performance-standalone.js http://localhost:3000
```

### Staging/Production Testing

**⚠️ Warning:** Running performance tests against production can impact real users. Always test during low-traffic periods or use a staging environment.

```bash
# Test staging environment
node backend/tests/performance-standalone.js https://staging.yourdomain.com

# Test production (use with extreme caution)
node backend/tests/performance-standalone.js https://yourdomain.com
```

## Troubleshooting

### High Response Times

If average response time exceeds 500ms:

1. **Check Database Performance:**
   - Review database connection pool settings
   - Check for slow queries
   - Verify Neon DB performance metrics

2. **Check RPC Performance:**
   - Verify Solana RPC endpoint response times
   - Consider using a dedicated RPC provider (Helius, QuickNode)
   - Check if fallback RPC is being used

3. **Check Server Resources:**
   - CPU usage
   - Memory usage
   - Network latency

4. **Review Logs:**
   - Check for errors or warnings
   - Look for timeout issues
   - Verify no rate limiting is triggered

### Request Failures

If requests are failing:

1. **Check Server Status:**
   - Verify server is running
   - Check health endpoint manually: `curl http://localhost:3000/health`

2. **Check Dependencies:**
   - Database connectivity
   - RPC endpoint availability
   - Network connectivity

3. **Review Error Messages:**
   - Check console output for specific errors
   - Review server logs

### Inconsistent Results

If response times vary significantly:

1. **Network Issues:**
   - Check network stability
   - Test from different locations

2. **Server Load:**
   - Ensure no other processes are consuming resources
   - Check if other tests are running concurrently

3. **External Dependencies:**
   - Verify RPC endpoint stability
   - Check database performance

## Best Practices

1. **Run Multiple Times:**
   - Run tests 3-5 times to get consistent results
   - Average the results for more reliable metrics

2. **Warm-up Period:**
   - Consider adding a warm-up phase before measuring
   - First requests may be slower due to cold starts

3. **Realistic Conditions:**
   - Test with realistic data volumes
   - Use production-like configurations

4. **Monitor During Tests:**
   - Watch server logs
   - Monitor resource usage
   - Check for errors or warnings

5. **Document Results:**
   - Keep records of performance test results
   - Track trends over time
   - Note any configuration changes

## Performance Optimization Tips

If you need to improve performance:

1. **Database Optimization:**
   - Add indexes on frequently queried columns
   - Optimize query patterns
   - Use connection pooling effectively

2. **Caching:**
   - Implement in-memory caching for frequently accessed data
   - Use LRU cache for collection data
   - Cache RPC responses when appropriate

3. **RPC Optimization:**
   - Use dedicated RPC providers
   - Implement request batching
   - Add retry logic with exponential backoff

4. **Code Optimization:**
   - Profile code to identify bottlenecks
   - Optimize hot paths
   - Reduce unnecessary computations

5. **Infrastructure:**
   - Scale horizontally (add more instances)
   - Use CDN for static assets
   - Optimize network routing

## Related Requirements

- **Requirement 38.2**: Reward calculation performance (100 NFTs < 500ms)
- **Requirement 38.3**: Database connection handling (20 concurrent connections)
- **Requirement 38.4**: Frontend Lighthouse score (> 85)
- **Requirement 38.5**: Realistic mainnet transaction volumes

## Additional Resources

- [Vercel Performance Documentation](https://vercel.com/docs/concepts/analytics)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Solana RPC Performance](https://docs.solana.com/cluster/rpc-endpoints)
