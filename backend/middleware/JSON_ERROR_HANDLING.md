# JSON Error Handling Implementation

## Overview

This document describes the comprehensive JSON parsing error handling implementation for the Solana NFT Staking Platform backend. This implementation satisfies Requirements 16.1, 16.2, 16.3, and 16.4 from the production readiness specification.

## Requirements Addressed

### Requirement 16.1: Catch and Log Parsing Errors
**Status:** ✅ Implemented

All JSON parsing operations use try-catch blocks to catch parsing errors. Errors are logged with context including:
- The input string (first 100 characters)
- The error message
- The request URL and method (for request body parsing)

### Requirement 16.2: Return HTTP 400 on Parse Failure
**Status:** ✅ Implemented

When JSON parsing fails, the API returns HTTP 400 with a structured error response:
```json
{
  "success": false,
  "error": "Invalid JSON in request body",
  "details": "Unexpected token...",
  "code": "JSON_PARSE_ERROR"
}
```

### Requirement 16.3: Validate JSON Structure
**Status:** ✅ Implemented

The implementation includes schema validation to ensure parsed JSON matches expected structure:
- Type validation (object, array, string, number)
- Required field validation
- Nested structure validation
- Custom validator support

### Requirement 16.4: Do Not Silently Ignore Malformed JSON
**Status:** ✅ Implemented

All JSON parsing failures are:
1. Logged with full context
2. Returned as errors to the caller
3. Never silently ignored or replaced with default values without notification

## Components

### 1. JSON Parse Error Handler Middleware

**File:** `backend/middleware/jsonErrorHandler.js`

**Function:** `jsonParseErrorHandler(err, req, res, next)`

Catches SyntaxError exceptions thrown by Express's `express.json()` middleware and returns HTTP 400 with error details.

**Usage:**
```javascript
// In server.js
const { jsonParseErrorHandler } = require('./middleware/jsonErrorHandler');

// Must be placed AFTER routes that use express.json()
app.use(jsonParseErrorHandler);
```

### 2. Safe JSON Parsing Utility

**Function:** `safeParseJSON(jsonString, defaultValue, options)`

A utility function for safely parsing JSON strings with comprehensive error handling.

**Parameters:**
- `jsonString` (string): The JSON string to parse
- `defaultValue` (any): Default value to return on parse failure
- `options` (object): Optional configuration
  - `validator` (function): Custom validation function for parsed data

**Returns:**
```javascript
{
  success: boolean,  // Whether parsing succeeded
  data: any,        // Parsed data or default value
  error: string     // Error message if parsing failed
}
```

**Usage Examples:**

```javascript
const { safeParseJSON } = require('./middleware/jsonErrorHandler');

// Basic usage
const result = safeParseJSON('{"name":"test"}', {});
if (result.success) {
  console.log('Parsed:', result.data);
} else {
  console.error('Parse error:', result.error);
}

// With custom validator
const validator = (data) => {
  if (!Array.isArray(data)) {
    return { valid: false, error: 'Expected array' };
  }
  return { valid: true };
};

const traitsResult = safeParseJSON(traitsString, [], { validator });
```

### 3. JSON Schema Validation

**Function:** `validateJSONSchema(data, schema)`

Validates that parsed JSON data matches an expected schema.

**Schema Format:**
```javascript
{
  type: 'object' | 'array' | 'string' | 'number',
  required: ['field1', 'field2'],  // For objects
  items: { /* schema for array items */ }  // For arrays
}
```

**Example:**
```javascript
const schema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['trait_type', 'value']
  }
};

const validation = validateJSONSchema(data, schema);
if (!validation.valid) {
  console.error('Validation error:', validation.error);
}
```

### 4. Request Body Validation Middleware

**Function:** `validateJSONBody(schema)`

Express middleware to validate request body structure.

**Usage:**
```javascript
const { validateJSONBody } = require('./middleware/jsonErrorHandler');

router.post('/api/endpoint', 
  validateJSONBody({
    type: 'object',
    required: ['name', 'email']
  }),
  async (req, res) => {
    // Request body is guaranteed to have name and email
  }
);
```

## Implementation Details

### Request Body Parsing

Express's `express.json()` middleware automatically parses JSON request bodies. When parsing fails, it throws a SyntaxError. Our `jsonParseErrorHandler` middleware catches these errors and returns HTTP 400.

**Flow:**
1. Client sends request with JSON body
2. `express.json()` attempts to parse
3. If parsing fails, SyntaxError is thrown
4. `jsonParseErrorHandler` catches error
5. HTTP 400 response returned with error details

### Traits JSON Parsing

NFT traits are stored as JSON strings in the database. When retrieving traits, we use `safeParseJSON` to handle potential corruption or malformed data.

**Implementation in `solana-rewards-handler.js`:**
```javascript
const { safeParseJSON } = require('../middleware/jsonErrorHandler');

// Parse traits with error handling
const traits = safeParseJSONLegacy(nft.traits, []);

// Legacy wrapper for backward compatibility
function safeParseJSONLegacy(jsonString, defaultValue = []) {
  const result = safeParseJSON(jsonString, defaultValue);
  if (!result.success) {
    console.warn('JSON parsing failed:', result.error);
  }
  return result.data;
}
```

### Staking Endpoint Validation

The staking endpoints validate traits structure before processing:

**Implementation in `solana-api-endpoints.js`:**
```javascript
// Validate traits structure
for (let i = 0; i < nfts.length; i++) {
  const nft = nfts[i];
  if (nft.traits !== undefined && nft.traits !== null) {
    if (!Array.isArray(nft.traits)) {
      return res.status(400).json({
        success: false,
        message: `Invalid traits format for NFT at index ${i}. Expected array.`,
        code: 'INVALID_TRAITS_FORMAT'
      });
    }
    
    // Validate each trait object
    for (let j = 0; j < nft.traits.length; j++) {
      const trait = nft.traits[j];
      if (typeof trait !== 'object' || trait === null) {
        return res.status(400).json({
          success: false,
          message: `Invalid trait at index ${j} for NFT at index ${i}. Expected object.`,
          code: 'INVALID_TRAIT_OBJECT'
        });
      }
    }
  }
}
```

## Error Response Format

All JSON parsing errors return a consistent error response format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE"
}
```

**Error Codes:**
- `JSON_PARSE_ERROR`: JSON syntax error in request body
- `INVALID_SCHEMA`: Request body doesn't match expected schema
- `MISSING_BODY`: Request body is required but not provided
- `INVALID_TRAITS_FORMAT`: Traits field is not an array
- `INVALID_TRAIT_OBJECT`: Trait item is not an object

## Testing

Comprehensive test suite in `backend/middleware/jsonErrorHandler.test.js` covers:

1. **Middleware Tests:**
   - Catching JSON syntax errors
   - Returning HTTP 400 with error details
   - Passing non-JSON errors to next handler

2. **Safe Parsing Tests:**
   - Valid JSON parsing
   - Malformed JSON handling
   - Null/undefined/empty string handling
   - Non-string input handling
   - Custom validator support

3. **Schema Validation Tests:**
   - Type validation
   - Required field validation
   - Array item validation

4. **Integration Tests:**
   - Traits JSON parsing in staking flow
   - Settings JSON values
   - Request body validation

**Run tests:**
```bash
cd backend
npm test -- jsonErrorHandler.test.js
```

## Best Practices

### 1. Always Use Safe Parsing

Never use `JSON.parse()` directly. Always use `safeParseJSON()`:

```javascript
// ❌ Bad
const data = JSON.parse(jsonString);

// ✅ Good
const result = safeParseJSON(jsonString, defaultValue);
if (result.success) {
  const data = result.data;
} else {
  console.error('Parse error:', result.error);
}
```

### 2. Validate Structure After Parsing

For critical data, validate structure after parsing:

```javascript
const result = safeParseJSON(jsonString, [], {
  validator: (data) => {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Expected array' };
    }
    return { valid: true };
  }
});
```

### 3. Return Descriptive Errors

Always return descriptive error messages to help clients debug:

```javascript
return res.status(400).json({
  success: false,
  message: `Invalid traits format for NFT at index ${i}. Expected array.`,
  code: 'INVALID_TRAITS_FORMAT'
});
```

### 4. Log All Parse Failures

All parse failures are logged for debugging and monitoring:

```javascript
console.warn('Failed to parse JSON:', {
  input: jsonString.substring(0, 100),
  error: error.message
});
```

## Migration Guide

### Updating Existing Code

If you have existing code using `JSON.parse()`, update it to use `safeParseJSON()`:

**Before:**
```javascript
try {
  const data = JSON.parse(jsonString);
  // use data
} catch (error) {
  console.error('Parse error:', error);
  const data = defaultValue;
}
```

**After:**
```javascript
const result = safeParseJSON(jsonString, defaultValue);
if (result.success) {
  const data = result.data;
  // use data
} else {
  console.error('Parse error:', result.error);
}
```

## Monitoring

Monitor JSON parsing errors in production:

1. **Error Logs:** Check logs for "Failed to parse JSON" warnings
2. **HTTP 400 Responses:** Monitor rate of 400 responses with `JSON_PARSE_ERROR` code
3. **Client Feedback:** Track client-reported parsing errors

## Security Considerations

1. **Input Validation:** Always validate JSON structure after parsing
2. **Error Messages:** Don't expose sensitive data in error messages
3. **DoS Prevention:** Large JSON payloads are limited by `express.json({ limit: '5mb' })`
4. **Injection Prevention:** JSON parsing is safe from injection attacks

## Performance

- **Caching:** Parsed JSON is not cached; parse on each request
- **Memory:** Default values prevent memory leaks from failed parses
- **Logging:** Only first 100 characters logged to prevent log bloat

## Future Enhancements

Potential improvements for future iterations:

1. **JSON Schema Validation:** Use JSON Schema standard for more complex validation
2. **Metrics:** Add Prometheus metrics for parse failure rates
3. **Sanitization:** Add JSON sanitization for untrusted input
4. **Streaming:** Support streaming JSON parsing for large payloads

## References

- Requirements Document: `.kiro/specs/production-readiness-mainnet-migration/requirements.md`
- Design Document: `.kiro/specs/production-readiness-mainnet-migration/design.md`
- Task List: `.kiro/specs/production-readiness-mainnet-migration/tasks.md`
- Test Suite: `backend/middleware/jsonErrorHandler.test.js`
