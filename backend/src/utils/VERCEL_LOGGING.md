# Vercel Logging Integration

This document explains how the logger integrates with Vercel's built-in logging infrastructure and how to view and filter logs in the Vercel Dashboard.

## Overview

The logger is designed to work seamlessly with Vercel's serverless environment. It outputs structured JSON logs to stdout/stderr, which Vercel automatically captures, indexes, and makes available through the Vercel Dashboard and CLI.

## How It Works

### Automatic Log Capture

Vercel automatically captures all output from your application:

- **stdout** (console.log, console.info): Captured as INFO level logs
- **stderr** (console.error, console.warn): Captured as ERROR/WARN level logs

Our logger uses these standard streams, so all logs are automatically sent to Vercel:

```javascript
const logger = require('./utils/logger');

// This outputs to stdout → Vercel captures it
logger.info('User authenticated', { walletAddress: 'DYw8...NSKK' });

// This outputs to stderr → Vercel captures it
logger.error('Transaction failed', { error: new Error('Timeout') });
```

### JSON Structured Logs

In production (NODE_ENV=production), the logger outputs JSON format:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "User authenticated",
  "walletAddress": "DYw8...NSKK",
  "service": "auth"
}
```

This structured format allows Vercel to:
- Parse and index log fields
- Enable filtering by any field
- Provide better search capabilities
- Display logs in a structured table view

## Viewing Logs in Vercel Dashboard

### Access Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click on the **"Logs"** tab in the top navigation

### Real-Time Logs

The Logs page shows real-time logs from your application:

- **Live Stream**: Logs appear in real-time as they're generated
- **Auto-Scroll**: The view automatically scrolls to show new logs
- **Pause**: Click the pause button to stop auto-scrolling and inspect logs

### Log Levels

Vercel displays logs with visual indicators for different levels:

- **INFO**: Blue indicator - normal operational messages
- **WARN**: Yellow indicator - warnings that don't prevent operation
- **ERROR**: Red indicator - errors that need attention

### Filtering Logs

#### Filter by Level

Use the level dropdown to show only specific log levels:

```
[Level Dropdown]
☐ All Levels
☑ INFO
☑ WARN
☑ ERROR
☐ DEBUG
```

Example: Select only ERROR to see failures and exceptions.

#### Filter by Time Range

Use the time range selector to view logs from specific periods:

```
[Time Range]
• Last 1 hour
• Last 24 hours
• Last 7 days
• Custom range
```

#### Filter by Deployment

View logs from specific deployments:

```
[Deployment Dropdown]
• Production (current)
• Preview (branch-name)
• Previous deployment
```

#### Search Logs

Use the search box to filter logs by content:

```
[Search Box]
Search logs...
```

**Search Examples:**

- Search by message: `"User authenticated"`
- Search by wallet: `"DYw8...NSKK"`
- Search by service: `"service":"auth"`
- Search by error: `"Transaction failed"`

### Structured Log View

Click on any log entry to see the full structured data:

```
[Expanded Log Entry]
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "User authenticated",
  "walletAddress": "DYw8...NSKK",
  "service": "auth",
  "requestId": "req_abc123",
  "duration": 45
}
```

## Using Vercel CLI for Logs

### Install Vercel CLI

```bash
npm install -g vercel
```

### View Logs

```bash
# View real-time logs
vercel logs

# View logs from production
vercel logs --prod

# View logs from specific deployment
vercel logs [deployment-url]

# Follow logs (like tail -f)
vercel logs --follow

# View last 100 logs
vercel logs --limit 100
```

### Filter Logs with CLI

```bash
# Filter by time
vercel logs --since 1h
vercel logs --since 24h
vercel logs --until 2024-01-15

# Filter by output (stdout/stderr)
vercel logs --output stdout
vercel logs --output stderr

# Combine filters
vercel logs --prod --since 1h --output stderr
```

### Search Logs with CLI

```bash
# Search for specific text
vercel logs | grep "Transaction failed"

# Search for wallet address
vercel logs | grep "DYw8"

# Search for errors
vercel logs --output stderr

# Count occurrences
vercel logs | grep "Rate limit exceeded" | wc -l
```

## Common Log Queries

### View All Errors

**Dashboard**: Filter by ERROR level

**CLI**:
```bash
vercel logs --output stderr --since 24h
```

### Find Failed Transactions

**Dashboard**: Search for "Transaction failed"

**CLI**:
```bash
vercel logs | grep "Transaction failed"
```

### Monitor Rate Limiting

**Dashboard**: Search for "Rate limit exceeded"

**CLI**:
```bash
vercel logs | grep "Rate limit exceeded"
```

### Track Specific User Activity

**Dashboard**: Search for wallet address (e.g., "DYw8...NSKK")

**CLI**:
```bash
vercel logs | grep "DYw8...NSKK"
```

### View Authentication Issues

**Dashboard**: Search for "service":"auth" and filter by ERROR

**CLI**:
```bash
vercel logs | grep '"service":"auth"' | grep ERROR
```

### Monitor Performance

**Dashboard**: Search for "duration" to see request timing

**CLI**:
```bash
vercel logs | grep "duration" | grep -o '"duration":[0-9]*'
```

## Log Retention

Vercel log retention depends on your plan:

- **Hobby**: 1 hour of logs
- **Pro**: 1 day of logs
- **Enterprise**: Custom retention (up to 30 days)

For longer retention, consider:
1. Exporting logs to external service (Datadog, LogDNA, etc.)
2. Using Vercel's log drains feature
3. Implementing custom log aggregation

## Setting Up Log Drains (Optional)

For advanced monitoring, you can set up log drains to send logs to external services:

### Configure Log Drain

```bash
# Add log drain
vercel log-drain add [service-url]

# List log drains
vercel log-drain ls

# Remove log drain
vercel log-drain rm [drain-id]
```

### Supported Services

- Datadog
- LogDNA
- Logtail
- Splunk
- Custom HTTP endpoint

### Example: Datadog Integration

```bash
vercel log-drain add https://http-intake.logs.datadoghq.com/v1/input/[API_KEY]
```

## Best Practices

### 1. Use Structured Logging

Always include relevant metadata:

```javascript
// Good
logger.info('Transaction processed', {
  transactionId: tx.id,
  walletAddress: wallet,
  amount: amount,
  duration: Date.now() - start
});

// Bad
logger.info(`Transaction ${tx.id} processed for ${wallet}`);
```

### 2. Use Consistent Field Names

Use the same field names across your application:

```javascript
// Consistent
logger.info('Request started', { requestId: req.id });
logger.info('Request completed', { requestId: req.id, duration: 123 });

// Inconsistent
logger.info('Request started', { reqId: req.id });
logger.info('Request completed', { request_id: req.id, time: 123 });
```

### 3. Include Context

Use child loggers to include context automatically:

```javascript
const requestLogger = logger.child({
  requestId: req.id,
  method: req.method,
  path: req.path
});

// All logs include request context
requestLogger.info('Processing stake request');
requestLogger.error('Validation failed', { error });
```

### 4. Log at Appropriate Levels

- **DEBUG**: Detailed debugging (not logged in production)
- **INFO**: Normal operations, user actions
- **WARN**: Warnings, retries, approaching limits
- **ERROR**: Failures, exceptions, errors

### 5. Don't Log Too Much

Avoid logging in tight loops or high-frequency operations:

```javascript
// Bad - logs 1000 times
for (const nft of nfts) {
  logger.info('Processing NFT', { mint: nft.mint });
}

// Good - logs once with summary
logger.info('Processing NFTs', { count: nfts.length });
```

### 6. Use Error Objects

Always pass error objects to capture stack traces:

```javascript
// Good
try {
  await processTransaction(tx);
} catch (error) {
  logger.error('Transaction failed', { error, txId: tx.id });
}

// Bad
catch (error) {
  logger.error('Transaction failed: ' + error.message);
}
```

## Monitoring Checklist

Use Vercel Logs to monitor:

- [ ] **Error Rate**: Check ERROR logs daily
- [ ] **Performance**: Monitor request duration
- [ ] **Rate Limiting**: Track rate limit hits
- [ ] **Authentication**: Monitor auth failures
- [ ] **Transactions**: Track transaction failures
- [ ] **Database**: Monitor connection errors
- [ ] **External APIs**: Track Helius/RPC failures

## Troubleshooting

### Logs Not Appearing

1. **Check deployment status**: Ensure deployment is live
2. **Check log level**: Ensure you're logging at INFO or higher in production
3. **Check time range**: Expand time range in dashboard
4. **Check deployment filter**: Ensure you're viewing the correct deployment

### Missing Log Fields

1. **Check JSON format**: Ensure logs are valid JSON in production
2. **Check field names**: Use consistent field naming
3. **Check redaction**: Sensitive fields may be redacted

### Performance Issues

1. **Reduce log volume**: Don't log in tight loops
2. **Use appropriate levels**: Use DEBUG for verbose logs
3. **Batch operations**: Log summaries instead of individual items

## Requirements Satisfied

- **31.5**: Integration with Vercel's built-in logging infrastructure ✓
  - Logger outputs to stdout/stderr which Vercel captures automatically
  - JSON structured format for easy parsing and filtering
  - Documentation for viewing and filtering logs in Vercel Dashboard
  - CLI commands for programmatic log access
  - Best practices for effective logging in Vercel environment

## Additional Resources

- [Vercel Logs Documentation](https://vercel.com/docs/concepts/observability/logs)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Log Drains](https://vercel.com/docs/concepts/observability/log-drains)
- [Structured Logging Best Practices](https://www.datadoghq.com/blog/structured-logging/)
