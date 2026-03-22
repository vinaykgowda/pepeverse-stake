# Neon DB Configuration

This document describes the Neon DB serverless PostgreSQL configuration for the Solana NFT Staking Platform.

## Overview

The platform uses Neon DB, a serverless PostgreSQL database optimized for serverless and edge deployments. Neon provides built-in connection pooling that works seamlessly with Vercel's serverless functions.

## Configuration

### Environment Variables

Set the following environment variable in your Vercel project settings:

```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

**Important:** Never commit the `DATABASE_URL` to version control. Always use Vercel environment variables.

### Connection Settings

The database manager is configured with the following settings (as per Requirements 17.1, 17.2, 17.3):

- **Connection Timeout**: 10 seconds
- **Max Connections**: 20
- **SSL**: Enabled with `rejectUnauthorized: false` (required for Neon)
- **Connection Pooling**: Handled automatically by Neon's serverless pooling

## Usage

### Basic Usage

```javascript
const database = require('./config/database');

// Execute a query
const result = await database.query('SELECT * FROM users WHERE id = $1', [userId]);

// Get a client for transactions
const client = await database.getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}

// Health check
const isHealthy = await database.healthCheck();
```

### Backward Compatibility

For existing code using the old `db.js` interface:

```javascript
const { initializeDatabase, getPool } = require('./db');

// Initialize on startup
await initializeDatabase();

// Get database instance
const db = getPool();
const result = await db.query('SELECT * FROM users');
```

## Features

### Automatic Query Logging

All queries are automatically logged with execution time:

```
Query executed { text: 'SELECT * FROM users', duration: 45, rows: 10 }
```

### Error Handling

Query errors are logged with details:

```
Query error: { text: 'SELECT * FROM invalid', error: 'relation "invalid" does not exist' }
```

### Health Checks

The `healthCheck()` method verifies database connectivity:

```javascript
const isHealthy = await database.healthCheck();
if (!isHealthy) {
  console.error('Database is unhealthy');
}
```

## Neon DB Advantages

1. **Serverless Pooling**: Neon automatically manages connection pooling for serverless environments
2. **Auto-scaling**: Connections scale automatically based on demand
3. **Cold Start Optimization**: Fast connection establishment for serverless functions
4. **Branching**: Create database branches for development and testing
5. **Cost Efficiency**: Pay only for actual compute and storage used

## Migration from MySQL

The platform has been migrated from MySQL to PostgreSQL. Key differences:

### Query Syntax Changes

**MySQL:**
```sql
SELECT * FROM users WHERE id = ?
```

**PostgreSQL:**
```sql
SELECT * FROM users WHERE id = $1
```

### Data Types

- `DATETIME` → `TIMESTAMP`
- `TINYINT(1)` → `BOOLEAN`
- `TEXT` → `TEXT` (same)
- `INT` → `INTEGER`

### Auto-increment

**MySQL:**
```sql
id INT AUTO_INCREMENT PRIMARY KEY
```

**PostgreSQL:**
```sql
id SERIAL PRIMARY KEY
-- or
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

## Troubleshooting

### Connection Timeout

If you see connection timeout errors:

1. Check that `DATABASE_URL` is correctly set in Vercel
2. Verify the connection string format includes `?sslmode=require`
3. Check Neon DB dashboard for database status
4. Ensure your Neon project is not suspended (free tier limitation)

### SSL Certificate Errors

If you see SSL certificate errors:

1. Ensure `sslmode=require` is in the connection string
2. The configuration uses `rejectUnauthorized: false` which is required for Neon

### Pool Exhaustion

If you see "too many connections" errors:

1. Check that clients are properly released after use
2. Use transactions properly with try/finally blocks
3. Consider increasing the `max` pool size (currently 20)

### Query Performance

For slow queries:

1. Check query execution logs for duration
2. Add appropriate indexes (see migration 003_add_performance_indexes.js)
3. Use `EXPLAIN ANALYZE` to understand query plans
4. Consider using Neon's query insights in the dashboard

## Testing

Run the database configuration tests:

```bash
npm test -- database.test.js
npm test -- db.test.js
```

## References

- [Neon Documentation](https://neon.tech/docs)
- [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)
- [PostgreSQL Node.js Driver (pg)](https://node-postgres.com/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## Requirements Satisfied

- **Requirement 17.1**: Uses Neon DB's built-in connection pooling for serverless environments
- **Requirement 17.2**: Configures 10-second connection timeout
- **Requirement 17.3**: Handles connection errors gracefully with retry logic (via health check)
