# CORS Security Configuration

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) security configuration for the Solana NFT Staking Platform. The configuration implements a strict whitelist-based approach to prevent unauthorized cross-origin access.

## Requirements Addressed

- **Requirement 7.1**: Explicit whitelist of allowed origins
- **Requirement 7.2**: Reject non-whitelisted origins
- **Requirement 7.3**: No wildcard (*) in production
- **Requirement 7.4**: Allow localhost in development

## Configuration

### Environment Variables

The CORS configuration is controlled by the following environment variables:

```bash
# Required: Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com

# Required: Environment mode (affects localhost handling)
NODE_ENV=production  # or 'development'
```

### Production Configuration

In production mode (`NODE_ENV=production`):

1. **Explicit Whitelist**: Only origins listed in `ALLOWED_ORIGINS` are allowed
2. **No Wildcards**: The wildcard (`*`) is never used for `Access-Control-Allow-Origin`
3. **Strict Validation**: All origins are validated against the whitelist
4. **Localhost Blocked**: Localhost origins are NOT automatically allowed

Example production configuration:

```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://staking.example.com,https://www.staking.example.com
```

### Development Configuration

In development mode (`NODE_ENV=development`):

1. **Automatic Localhost**: Common localhost ports are automatically whitelisted
2. **Configured Origins**: Origins from `ALLOWED_ORIGINS` are still respected
3. **Flexible Testing**: Supports multiple development ports

Automatically allowed localhost origins in development:
- `http://localhost:3000` (React default)
- `http://localhost:3001` (Backend default)
- `http://localhost:5173` (Vite default)
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`
- `http://127.0.0.1:5173`

Example development configuration:

```bash
NODE_ENV=development
ALLOWED_ORIGINS=https://staging.example.com
```

## Implementation Details

### CORS Middleware Configuration

```javascript
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in whitelist
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from origin: ${origin}`;
      console.warn(`CORS rejection: ${msg}`);
      return callback(new Error(msg), false);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Key Features

1. **Dynamic Origin Validation**: Each request's origin is validated against the whitelist
2. **Credentials Support**: Allows cookies and authentication headers (`credentials: true`)
3. **Specific Methods**: Only allows necessary HTTP methods
4. **Limited Headers**: Only allows required headers (Content-Type, Authorization)
5. **No-Origin Requests**: Allows requests without an origin header (mobile apps, API clients)

## Security Considerations

### Why No Wildcard?

Using `Access-Control-Allow-Origin: *` is a security risk because:

1. **Unrestricted Access**: Any website can make requests to your API
2. **Credential Leakage**: Cannot use credentials with wildcard
3. **CSRF Vulnerability**: Increases risk of cross-site request forgery
4. **Data Exposure**: Sensitive data could be accessed by malicious sites

### Why Whitelist Approach?

The whitelist approach provides:

1. **Explicit Control**: You know exactly which origins can access your API
2. **Defense in Depth**: Even if other security measures fail, CORS provides a barrier
3. **Audit Trail**: Easy to review and audit allowed origins
4. **Compliance**: Meets security compliance requirements

### Why Allow No-Origin Requests?

Requests without an origin header are allowed because:

1. **Mobile Apps**: Native mobile apps don't send origin headers
2. **API Clients**: Tools like curl, Postman, and server-to-server calls have no origin
3. **Browser Behavior**: Some browser features don't include origin headers
4. **Not a Security Risk**: These requests are not subject to CORS (not cross-origin)

## Testing

### Running Tests

```bash
cd backend
npm test -- cors.test.js
```

### Test Coverage

The test suite validates:

1. ✅ Whitelisted origins are allowed
2. ✅ Multiple whitelisted origins work correctly
3. ✅ Non-whitelisted origins are rejected
4. ✅ Localhost is rejected in production
5. ✅ No wildcard is used
6. ✅ Specific origins are returned (not wildcard)
7. ✅ Localhost is allowed in development
8. ✅ Multiple localhost ports work in development
9. ✅ Configured origins work in development
10. ✅ No-origin requests are allowed
11. ✅ Credentials are supported
12. ✅ Allowed methods are specified
13. ✅ Allowed headers are specified
14. ✅ Whitespace in configuration is handled
15. ✅ Trailing slashes are handled

## Deployment Checklist

### Before Production Deployment

- [ ] Set `NODE_ENV=production` in Vercel environment variables
- [ ] Configure `ALLOWED_ORIGINS` with production domain(s)
- [ ] Remove any localhost origins from `ALLOWED_ORIGINS`
- [ ] Verify no wildcard (`*`) is used
- [ ] Test CORS with production domains
- [ ] Verify non-whitelisted origins are rejected

### Vercel Configuration

In Vercel project settings, add environment variables:

```
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Multiple Domains

If you have multiple domains (e.g., main site, admin panel, mobile app):

```
ALLOWED_ORIGINS=https://staking.example.com,https://admin.example.com,https://app.example.com
```

## Troubleshooting

### CORS Error in Browser Console

**Error**: `Access to fetch at 'https://api.example.com' from origin 'https://app.example.com' has been blocked by CORS policy`

**Solution**: Add `https://app.example.com` to `ALLOWED_ORIGINS` environment variable

### Localhost Not Working in Development

**Error**: CORS blocks localhost requests in development

**Solution**: 
1. Verify `NODE_ENV=development` is set
2. Check server logs for "Development mode: localhost origins automatically allowed"
3. Ensure you're using a supported localhost port (3000, 3001, 5173)

### Postman/curl Requests Blocked

**Error**: API requests from Postman or curl are blocked

**Solution**: This should NOT happen - no-origin requests are allowed. If blocked:
1. Check if you're manually setting an Origin header
2. Remove the Origin header or add it to `ALLOWED_ORIGINS`

### Production Deployment Shows Wrong Origins

**Error**: Server logs show unexpected origins in whitelist

**Solution**:
1. Check Vercel environment variables are set correctly
2. Verify no trailing commas in `ALLOWED_ORIGINS`
3. Check for whitespace (automatically trimmed)
4. Redeploy after changing environment variables

## Monitoring

### Server Logs

The server logs CORS configuration on startup:

```
CORS Configuration:
  Environment: production
  Allowed origins: https://example.com, https://www.example.com
  Wildcard (*) allowed: false
```

### Rejection Logs

When an origin is rejected, a warning is logged:

```
CORS rejection: CORS policy does not allow access from origin: https://malicious-site.com
```

Monitor these logs to:
1. Detect unauthorized access attempts
2. Identify legitimate origins that need to be whitelisted
3. Audit CORS policy effectiveness

## Best Practices

1. **Minimize Origins**: Only whitelist origins that absolutely need access
2. **Use HTTPS**: Always use HTTPS for production origins
3. **Avoid Subdomains**: Don't use wildcard subdomains (e.g., `*.example.com`)
4. **Regular Audits**: Periodically review and remove unused origins
5. **Environment Separation**: Use different origins for staging and production
6. **Documentation**: Document why each origin is whitelisted

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP: CORS Security](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
