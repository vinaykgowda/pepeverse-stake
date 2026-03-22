# Vercel Logging Quick Reference

Quick reference for viewing and filtering logs in Vercel.

## Quick Access

**Dashboard**: [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → **Logs** tab

**CLI**: `vercel logs --prod --follow`

## Common Commands

### View Logs

```bash
# Real-time production logs
vercel logs --prod --follow

# Last 100 logs
vercel logs --prod --limit 100

# Logs from last hour
vercel logs --prod --since 1h

# Logs from last 24 hours
vercel logs --prod --since 24h
```

### Filter Logs

```bash
# Only errors (stderr)
vercel logs --prod --output stderr

# Only info logs (stdout)
vercel logs --prod --output stdout

# Search for specific text
vercel logs --prod | grep "Transaction failed"

# Count occurrences
vercel logs --prod | grep "Rate limit exceeded" | wc -l
```

## Common Searches

### Dashboard Search Box

| What to Find | Search Query |
|--------------|--------------|
| All errors | Filter by ERROR level |
| Failed transactions | `"Transaction failed"` |
| Rate limiting | `"Rate limit exceeded"` |
| Auth issues | `"service":"auth"` + ERROR filter |
| Specific wallet | `"DYw8...NSKK"` (first 4 + last 4) |
| Slow requests | `"duration"` then sort by value |
| Database errors | `"database"` + ERROR filter |
| Helius failures | `"Helius"` + ERROR filter |

### CLI Searches

```bash
# Failed transactions
vercel logs --prod | grep "Transaction failed"

# Rate limiting
vercel logs --prod | grep "Rate limit exceeded"

# Authentication errors
vercel logs --prod --output stderr | grep "auth"

# Slow requests (>1000ms)
vercel logs --prod | grep "duration" | grep -E "duration\":[0-9]{4,}"

# Database errors
vercel logs --prod --output stderr | grep "database"

# Specific wallet activity
vercel logs --prod | grep "DYw8...NSKK"
```

## Log Levels

| Level | Color | When to Use | CLI Filter |
|-------|-------|-------------|------------|
| INFO | Blue | Normal operations | `--output stdout` |
| WARN | Yellow | Warnings, retries | `--output stderr` + grep WARN |
| ERROR | Red | Failures, exceptions | `--output stderr` |

## Structured Log Fields

All logs include these fields (searchable in dashboard):

- `timestamp`: ISO 8601 timestamp
- `level`: INFO, WARN, ERROR
- `message`: Log message
- Custom fields: `requestId`, `walletAddress`, `duration`, etc.

## Monitoring Checklist

Daily checks:

```bash
# 1. Check for errors in last 24h
vercel logs --prod --since 24h --output stderr

# 2. Count rate limit hits
vercel logs --prod --since 24h | grep "Rate limit exceeded" | wc -l

# 3. Check transaction failures
vercel logs --prod --since 24h | grep "Transaction failed"

# 4. Monitor slow requests (>1s)
vercel logs --prod --since 24h | grep "duration" | grep -E "duration\":[0-9]{4,}"
```

## Troubleshooting

### No logs appearing?
1. Check deployment is live: `vercel ls`
2. Check time range in dashboard
3. Verify correct deployment selected

### Can't find specific log?
1. Expand time range
2. Check log level filter
3. Try CLI search: `vercel logs --prod | grep "search term"`

### Too many logs?
1. Filter by level (ERROR only)
2. Use time range (last 1h)
3. Search for specific field

## Log Retention

- **Hobby**: 1 hour
- **Pro**: 1 day
- **Enterprise**: Up to 30 days

For longer retention, set up log drains to external services.

## Need More Details?

See [VERCEL_LOGGING.md](./VERCEL_LOGGING.md) for comprehensive documentation.
