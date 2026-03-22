// backend/middleware/jsonErrorHandler.js
// Requirements: 16.1, 16.2, 16.3, 16.4 - JSON parsing error handling

/**
 * Middleware to handle JSON parsing errors from express.json()
 * Catches SyntaxError thrown by JSON.parse() and returns HTTP 400
 * Requirements: 16.1, 16.2
 */
function jsonParseErrorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // Requirement 16.1: Catch JSON parsing errors
    console.error('JSON Parse Error:', {
      message: err.message,
      body: err.body,
      url: req.url,
      method: req.method
    });

    // Requirement 16.2: Return HTTP 400 with error details
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      details: err.message,
      code: 'JSON_PARSE_ERROR'
    });
  }

  // Pass to next error handler if not a JSON parse error
  next(err);
}

/**
 * Safe JSON parsing utility function
 * Requirements: 16.1, 16.3, 16.4
 * 
 * @param {string} jsonString - The JSON string to parse
 * @param {*} defaultValue - Default value to return on parse failure
 * @param {Object} options - Parsing options
 * @param {Function} options.validator - Optional validation function for parsed data
 * @returns {Object} - { success: boolean, data: any, error: string }
 */
function safeParseJSON(jsonString, defaultValue = null, options = {}) {
  // Handle null, undefined, or non-string inputs
  if (jsonString === null || jsonString === undefined) {
    return {
      success: true,
      data: defaultValue
    };
  }

  if (typeof jsonString !== 'string') {
    console.warn('safeParseJSON: Input is not a string:', typeof jsonString);
    return {
      success: false,
      data: defaultValue,
      error: 'Input must be a string'
    };
  }

  // Handle empty strings
  if (jsonString.trim() === '') {
    return {
      success: true,
      data: defaultValue
    };
  }

  try {
    // Requirement 16.1: Catch parsing errors
    const parsed = JSON.parse(jsonString);

    // Requirement 16.3: Validate JSON structure if validator provided
    if (options.validator && typeof options.validator === 'function') {
      const validationResult = options.validator(parsed);
      if (!validationResult.valid) {
        console.warn('JSON validation failed:', validationResult.error);
        return {
          success: false,
          data: defaultValue,
          error: validationResult.error || 'JSON structure validation failed'
        };
      }
    }

    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    // Requirement 16.1: Log parsing errors
    console.warn('Failed to parse JSON:', {
      input: jsonString.substring(0, 100), // Log first 100 chars
      error: error.message
    });

    // Requirement 16.4: Do not silently ignore malformed JSON
    return {
      success: false,
      data: defaultValue,
      error: error.message
    };
  }
}

/**
 * Validates that parsed JSON matches expected schema
 * Requirement 16.3
 * 
 * @param {*} data - Parsed JSON data
 * @param {Object} schema - Expected schema definition
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateJSONSchema(data, schema) {
  if (!schema) {
    return { valid: true };
  }

  // Check type
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (actualType !== schema.type) {
      return {
        valid: false,
        error: `Expected type ${schema.type}, got ${actualType}`
      };
    }
  }

  // Check required fields for objects
  if (schema.type === 'object' && schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        return {
          valid: false,
          error: `Missing required field: ${field}`
        };
      }
    }
  }

  // Check array items
  if (schema.type === 'array' && schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const itemValidation = validateJSONSchema(data[i], schema.items);
      if (!itemValidation.valid) {
        return {
          valid: false,
          error: `Array item ${i}: ${itemValidation.error}`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Express middleware to validate JSON request body structure
 * Requirement 16.3
 * 
 * @param {Object} schema - Expected schema definition
 * @returns {Function} Express middleware function
 */
function validateJSONBody(schema) {
  return (req, res, next) => {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
    }

    const validation = validateJSONSchema(req.body, schema);
    if (!validation.valid) {
      // Requirement 16.2: Return HTTP 400 with error details
      return res.status(400).json({
        success: false,
        error: 'Invalid request body structure',
        details: validation.error,
        code: 'INVALID_SCHEMA'
      });
    }

    next();
  };
}

module.exports = {
  jsonParseErrorHandler,
  safeParseJSON,
  validateJSONSchema,
  validateJSONBody
};
