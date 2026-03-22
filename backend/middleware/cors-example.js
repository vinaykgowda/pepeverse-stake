// backend/middleware/cors-example.js
// Example configurations for different deployment scenarios

/**
 * EXAMPLE 1: Single Production Domain
 * 
 * Use case: Simple deployment with one domain
 */
const example1 = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com'
};

/**
 * EXAMPLE 2: Multiple Production Domains
 * 
 * Use case: Main site + www subdomain
 */
const example2 = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com,https://www.staking.example.com'
};

/**
 * EXAMPLE 3: Production + Admin Panel
 * 
 * Use case: Separate admin interface
 */
const example3 = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com,https://admin.staking.example.com'
};

/**
 * EXAMPLE 4: Multiple Environments
 * 
 * Use case: Production + Staging
 * Note: Use separate Vercel deployments with different env vars
 */
const example4_production = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com'
};

const example4_staging = {
  NODE_ENV: 'production', // Still production mode, but different domain
  ALLOWED_ORIGINS: 'https://staging.staking.example.com'
};

/**
 * EXAMPLE 5: Development Mode
 * 
 * Use case: Local development
 * Note: Localhost origins are automatically added
 */
const example5 = {
  NODE_ENV: 'development',
  ALLOWED_ORIGINS: 'https://staging.example.com' // Optional: can also test staging
};

/**
 * EXAMPLE 6: Mobile App + Web
 * 
 * Use case: Web app + native mobile app
 * Note: Mobile apps don't send Origin header, so they work automatically
 */
const example6 = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com' // Mobile app requests have no origin
};

/**
 * EXAMPLE 7: Vercel Preview Deployments
 * 
 * Use case: Testing preview deployments
 * Note: Add preview domain to allowed origins
 */
const example7 = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://staking.example.com,https://staking-preview.vercel.app'
};

/**
 * TESTING CORS CONFIGURATION
 * 
 * Test with curl:
 */
const curlExamples = `
# Test allowed origin (should succeed)
curl -H "Origin: https://staking.example.com" \\
     -H "Access-Control-Request-Method: POST" \\
     -H "Access-Control-Request-Headers: Content-Type" \\
     -X OPTIONS \\
     https://api.example.com/api/v1/health

# Test blocked origin (should fail)
curl -H "Origin: https://malicious-site.com" \\
     -H "Access-Control-Request-Method: POST" \\
     -H "Access-Control-Request-Headers: Content-Type" \\
     -X OPTIONS \\
     https://api.example.com/api/v1/health

# Test no origin (should succeed - mobile apps, API clients)
curl -X GET https://api.example.com/api/v1/health
`;

/**
 * BROWSER TESTING
 * 
 * Test in browser console:
 */
const browserTestingExample = `
// Test from allowed origin
fetch('https://api.example.com/api/v1/health', {
  method: 'GET',
  credentials: 'include'
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('CORS Error:', error));

// Expected result from allowed origin:
// Success: { status: 'ok' }

// Expected result from blocked origin:
// CORS Error: Failed to fetch
// Console: Access to fetch at '...' has been blocked by CORS policy
`;

/**
 * COMMON MISTAKES TO AVOID
 */
const commonMistakes = {
  // ❌ WRONG: Using wildcard in production
  wrong1: {
    ALLOWED_ORIGINS: '*'
  },
  
  // ❌ WRONG: Including protocol in some but not others
  wrong2: {
    ALLOWED_ORIGINS: 'https://example.com,example2.com'
  },
  
  // ❌ WRONG: Including paths
  wrong3: {
    ALLOWED_ORIGINS: 'https://example.com/app'
  },
  
  // ❌ WRONG: Including ports for standard HTTPS
  wrong4: {
    ALLOWED_ORIGINS: 'https://example.com:443'
  },
  
  // ✅ CORRECT: Clean origins with protocol
  correct: {
    ALLOWED_ORIGINS: 'https://example.com,https://example2.com'
  }
};

/**
 * SECURITY CHECKLIST
 */
const securityChecklist = `
Before deploying to production:

□ NODE_ENV is set to 'production'
□ ALLOWED_ORIGINS contains only production domains
□ All origins use HTTPS (not HTTP)
□ No wildcard (*) is used
□ No localhost origins in production
□ Origins are comma-separated with no spaces (or spaces are trimmed)
□ No trailing slashes on origins
□ No paths included in origins
□ Tested with actual production domain
□ Verified blocked origins are rejected
□ Checked server logs for CORS configuration
`;

module.exports = {
  example1,
  example2,
  example3,
  example4_production,
  example4_staging,
  example5,
  example6,
  example7,
  curlExamples,
  browserTestingExample,
  commonMistakes,
  securityChecklist
};
