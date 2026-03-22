// backend/middleware/jsonErrorHandler.test.js
// Tests for JSON parsing error handling
// Requirements: 16.1, 16.2, 16.3, 16.4

const {
  jsonParseErrorHandler,
  safeParseJSON,
  validateJSONSchema,
  validateJSONBody
} = require('./jsonErrorHandler');

describe('JSON Error Handler Middleware', () => {
  describe('jsonParseErrorHandler', () => {
    it('should catch JSON syntax errors and return 400', () => {
      const err = new SyntaxError('Unexpected token');
      err.status = 400;
      err.body = '{ invalid json }';

      const req = { url: '/api/test', method: 'POST' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      jsonParseErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid JSON in request body',
        details: 'Unexpected token',
        code: 'JSON_PARSE_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass non-JSON errors to next handler', () => {
      const err = new Error('Some other error');
      const req = {};
      const res = {};
      const next = jest.fn();

      jsonParseErrorHandler(err, req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('safeParseJSON', () => {
    it('should parse valid JSON successfully', () => {
      const result = safeParseJSON('{"name":"test","value":123}');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.error).toBeUndefined();
    });

    it('should parse valid JSON array successfully', () => {
      const result = safeParseJSON('[1,2,3]');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should return default value for null input', () => {
      const result = safeParseJSON(null, { default: true });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ default: true });
    });

    it('should return default value for undefined input', () => {
      const result = safeParseJSON(undefined, []);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return default value for empty string', () => {
      const result = safeParseJSON('', { empty: true });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ empty: true });
    });

    it('should handle malformed JSON and return error', () => {
      const result = safeParseJSON('{ invalid json }', null);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.error).toBeDefined();
      // Error message varies by Node.js version
      expect(result.error.toLowerCase()).toMatch(/expected|unexpected|invalid/);
    });

    it('should handle non-string input', () => {
      const result = safeParseJSON(123, null);

      expect(result.success).toBe(false);
      expect(result.data).toBe(null);
      expect(result.error).toBe('Input must be a string');
    });

    it('should validate JSON structure with custom validator', () => {
      const validator = (data) => {
        if (!data.name || typeof data.name !== 'string') {
          return { valid: false, error: 'name field is required and must be a string' };
        }
        return { valid: true };
      };

      const validResult = safeParseJSON('{"name":"test"}', null, { validator });
      expect(validResult.success).toBe(true);

      const invalidResult = safeParseJSON('{"value":123}', null, { validator });
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('name field is required');
    });

    it('should handle traits array validation', () => {
      const validator = (data) => {
        if (!Array.isArray(data)) {
          return { valid: false, error: 'Expected array' };
        }
        for (const item of data) {
          if (typeof item !== 'object' || item === null) {
            return { valid: false, error: 'Array items must be objects' };
          }
        }
        return { valid: true };
      };

      const validTraits = safeParseJSON('[{"trait_type":"color","value":"red"}]', [], { validator });
      expect(validTraits.success).toBe(true);

      const invalidTraits = safeParseJSON('["string"]', [], { validator });
      expect(invalidTraits.success).toBe(false);
    });
  });

  describe('validateJSONSchema', () => {
    it('should validate object type', () => {
      const schema = { type: 'object' };
      
      const validResult = validateJSONSchema({ name: 'test' }, schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJSONSchema('string', schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Expected type object');
    });

    it('should validate array type', () => {
      const schema = { type: 'array' };
      
      const validResult = validateJSONSchema([1, 2, 3], schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJSONSchema({ key: 'value' }, schema);
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate required fields', () => {
      const schema = {
        type: 'object',
        required: ['name', 'email']
      };

      const validResult = validateJSONSchema({ name: 'test', email: 'test@example.com' }, schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJSONSchema({ name: 'test' }, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Missing required field: email');
    });

    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          required: ['trait_type', 'value']
        }
      };

      const validResult = validateJSONSchema([
        { trait_type: 'color', value: 'red' },
        { trait_type: 'size', value: 'large' }
      ], schema);
      expect(validResult.valid).toBe(true);

      const invalidResult = validateJSONSchema([
        { trait_type: 'color' }
      ], schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('Missing required field: value');
    });

    it('should return valid for no schema', () => {
      const result = validateJSONSchema({ anything: 'goes' }, null);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateJSONBody middleware', () => {
    it('should pass valid request body', () => {
      const schema = {
        type: 'object',
        required: ['name']
      };

      const middleware = validateJSONBody(schema);
      const req = { body: { name: 'test' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject missing request body', () => {
      const schema = { type: 'object' };
      const middleware = validateJSONBody(schema);
      
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request body is required',
        code: 'MISSING_BODY'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid request body structure', () => {
      const schema = {
        type: 'object',
        required: ['email']
      };

      const middleware = validateJSONBody(schema);
      const req = { body: { name: 'test' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request body structure',
        details: 'Missing required field: email',
        code: 'INVALID_SCHEMA'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle traits JSON parsing in staking flow', () => {
      // Valid traits
      const validTraits = safeParseJSON('[{"trait_type":"color","value":"red"}]', []);
      expect(validTraits.success).toBe(true);
      expect(validTraits.data).toHaveLength(1);

      // Invalid JSON
      const invalidJSON = safeParseJSON('not json', []);
      expect(invalidJSON.success).toBe(false);
      expect(invalidJSON.data).toEqual([]);

      // Empty string
      const emptyTraits = safeParseJSON('', []);
      expect(emptyTraits.success).toBe(true);
      expect(emptyTraits.data).toEqual([]);
    });

    it('should handle settings JSON values', () => {
      // Valid settings object
      const validSettings = safeParseJSON('{"key":"value","number":123}', {});
      expect(validSettings.success).toBe(true);
      expect(validSettings.data.key).toBe('value');

      // Malformed settings
      const invalidSettings = safeParseJSON('{key:value}', {});
      expect(invalidSettings.success).toBe(false);
      expect(invalidSettings.error).toBeDefined();
    });
  });
});
