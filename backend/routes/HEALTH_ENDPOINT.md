# Health Check Endpoint

## Overview

The health check endpoint provides real-time status information about the service and its critical dependencies. This endpoint is designed for monitoring systems, load balancers, and operational dashboards.

**Requirements:** 34.1, 34.2, 34.3

## Endpoint

```
GET /health
```

## Response Format

### Healthy Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "checks": {
    "database": "healthy",
    "solana_rpc": "healthy"
  },
  "details": {
    "database": {
      "responseTime": 45
    },
    "solana_rpc": {
      "responseTime": 120,
      "endpoint": "https://api.mainnet-beta.solana.com"
    }
  }
}
```

### Degraded Response (503 Service Unavailable)

```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "checks": {
    "database": "unhealthy",
    "solana_rpc": "healthy"
  },
  "details": {
    "database": {
      "responseTime": 10050,
      "error": "Connection timeout"
    },
    "solana_rpc": {
      "responseTime": 120,
      "endpoint": "https://api.mainnet-beta.solana.com"
    }
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall health status: `"healthy"` or `"degraded"` |
| `timestamp` | string | ISO 8601 timestamp of the health check |
| `checks` | object | Health status of each dependency |
| `checks.database` | string | Database health: `"healthy"` or `"unhealthy"` |
| `checks.solana_rpc` | string | RPC health: `"healthy"` or `"unhealthy"` |
| `details` | object | Detailed information about each check |
| `details.*.responseTime` | number | Response time in milliseconds |
| `details.*.endpoint` | string | (RPC only) The RPC endpoint being used |
| `details.*.error` | string | (Optional) Error message if check failed |
| `details.*.note` | string | (Optional) Additional information |

## Health Checks

### Database Check

Tests database connectivity by executing a simple query (`SELECT 1`). This verifies:
- Database connection pool is functional
- Network connectivity to Neon DB
- Database server is responding

**Healthy:** Query completes successfully  
**Unhealthy:** Query fails or times out

### Solana RPC Check

Tests Solana RPC connectivity by fetching a recent blockhash. This verifies:
- RPC endpoint is reachable
- Solana network is responding
- Authentication (if required) is working

**Fallback Behavior:** If the primary RPC fails, the health check automatically tries the fallback RPC endpoint. If the fallback succeeds, the check is marked as healthy with a note indicating fallback usage.

**Healthy:** RPC call completes successfully (primary or fallback)  
**Unhealthy:** Both primary and fallback RPC calls fail

## Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | All systems are healthy |
| 503 | Service Unavailable | One or more systems are degraded |

## Usage Examples

### cURL

```bash
# Check health
curl http://localhost:3001/health

# Check health with formatted output
curl -s http://localhost:3001/health | jq
```

### Monitoring Integration

#### Vercel Health Check

Configure in Vercel project settings:
- Health Check Path: `/health`
- Expected Status: `200`

#### Load Balancer

Configure health check:
- Protocol: HTTP
- Path: `/health`
- Success Codes: `200`
- Interval: 30 seconds
- Timeout: 5 seconds
- Unhealthy Threshold: 3 consecutive failures

#### Uptime Monitoring (e.g., UptimeRobot, Pingdom)

- URL: `https://yourdomain.com/health`
- Check Interval: 5 minutes
- Alert on: Status code != 200 OR response contains `"status": "degraded"`

## Implementation Details

### Response Time Tracking

Each health check measures and reports its response time in milliseconds. This helps identify performance degradation before complete failure.

### Fallback RPC Logic

The RPC health check implements automatic fallback:
1. Try primary RPC endpoint
2. If primary fails, try fallback RPC endpoint
3. If fallback succeeds, mark as healthy with note
4. If both fail, mark as unhealthy

This ensures the health check accurately reflects the service's ability to interact with the Solana network.

### Error Handling

All errors are caught and included in the response details. This provides diagnostic information without exposing sensitive data.

## Testing

Run the health check tests:

```bash
npm test -- health.test.js
```

Test coverage includes:
- All systems healthy (200 response)
- Database unhealthy (503 response)
- RPC unhealthy (503 response)
- Both systems unhealthy (503 response)
- Fallback RPC usage
- Response time tracking
- Error message inclusion
- Timestamp format validation

## Monitoring Best Practices

1. **Alert on 503 Status**: Set up alerts when the endpoint returns 503
2. **Monitor Response Times**: Track `responseTime` values to detect degradation
3. **Check Regularly**: Poll every 30-60 seconds for production systems
4. **Use Timeouts**: Set reasonable timeouts (5-10 seconds) for health checks
5. **Log Failures**: Log all health check failures for debugging
6. **Dashboard Integration**: Display health status on operational dashboards

## Troubleshooting

### Database Unhealthy

**Symptoms:** `checks.database: "unhealthy"`

**Possible Causes:**
- Neon DB connection pool exhausted
- Network connectivity issues
- Database server overloaded
- Invalid DATABASE_URL configuration

**Actions:**
1. Check Neon DB dashboard for connection limits
2. Verify DATABASE_URL environment variable
3. Check Vercel logs for database errors
4. Review recent database migrations

### RPC Unhealthy

**Symptoms:** `checks.solana_rpc: "unhealthy"`

**Possible Causes:**
- Solana network congestion
- RPC endpoint rate limiting
- Invalid RPC endpoint configuration
- Network connectivity issues

**Actions:**
1. Check Solana network status
2. Verify RPC endpoint URLs
3. Check for rate limiting errors
4. Try alternative RPC endpoints
5. Review Helius dashboard (if using Helius)

### High Response Times

**Symptoms:** `responseTime` values > 1000ms

**Possible Causes:**
- Network latency
- Database query performance
- RPC endpoint performance
- Server resource constraints

**Actions:**
1. Monitor Vercel function execution times
2. Check database query performance
3. Consider using different RPC endpoints
4. Review server resource usage

## Related Files

- `backend/routes/health.js` - Health check implementation
- `backend/routes/health.test.js` - Health check tests
- `backend/src/config/database.js` - Database configuration
- `backend/src/config/network.js` - Network configuration
- `backend/server.js` - Server setup with health route
