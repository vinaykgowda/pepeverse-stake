# Performance Test Quick Reference

## Quick Start

### Run Jest-based Tests
```bash
cd backend
npm test -- performance.test.js
```

### Run Standalone Test (Local)
```bash
# Start server first
npm run dev

# In another terminal
node backend/tests/performance-standalone.js http://localhost:3000
```

### Run Standalone Test (Remote)
```bash
node backend/tests/performance-standalone.js https://your-app.vercel.app
```

## What Gets Tested

- **50 concurrent users** making requests simultaneously
- **Average response time** must be under 500ms (Requirement 38.1)
- **Response consistency** across all requests
- **Sustained load** over multiple rounds

## Expected Results

✅ **PASS Criteria:**
- Average response time < 500ms
- 95%+ requests complete within 1 second
- Less than 5% failure rate

## Test Output Example

```
=== Performance Test Results ===
Total Requests: 50
Successful Requests: 50

Response Time Statistics (ms):
  Average: 73.32
  Min: 68
  Max: 88
  Median (P50): 73
  P95: 78
  P99: 88
================================

✅ PASS: Requirement 38.1 met
```

## Common Commands

```bash
# Run all tests including performance
npm test

# Run only performance tests
npm test -- performance.test.js

# Run with verbose output
npm test -- performance.test.js --verbose

# Run standalone against local server
node backend/tests/performance-standalone.js

# Run standalone against staging
node backend/tests/performance-standalone.js https://staging.example.com

# Set custom server URL via environment
SERVER_URL=http://localhost:3000 node backend/tests/performance-standalone.js
```

## Troubleshooting

### Test Fails (Response Time > 500ms)
1. Check database connection
2. Verify RPC endpoint performance
3. Review server logs for errors
4. Check system resources (CPU, memory)

### Connection Errors
1. Ensure server is running
2. Verify correct URL
3. Check firewall/network settings
4. Test health endpoint manually: `curl http://localhost:3000/health`

### Inconsistent Results
1. Run test multiple times
2. Check for background processes
3. Verify network stability
4. Test during low-traffic periods

## Files

- `performance.test.js` - Jest-based tests (mocked dependencies)
- `performance-standalone.js` - Standalone script (real server)
- `PERFORMANCE_TESTING.md` - Comprehensive documentation

## Requirements Validated

- ✅ **Requirement 38.1**: Backend handles 50 concurrent requests with average response time under 500ms

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Performance Test
  run: |
    npm start &
    sleep 5
    node backend/tests/performance-standalone.js http://localhost:3000
```

## Next Steps

After passing performance tests:
- Run Task 33.2: Test reward calculation performance
- Run Task 33.3: Test database connections
- Run Task 33.4: Run Lighthouse audit
