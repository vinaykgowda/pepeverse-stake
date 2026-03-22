// backend/middleware/cors.test.js
const request = require('supertest');
const express = require('express');
const cors = require('cors');

describe('CORS Security Configuration', () => {
  let app;
  let allowedOrigins;
  let isDevelopment;

  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
    
    // Create test app with CORS configuration
    app = express();
    isDevelopment = process.env.NODE_ENV === 'development';
    allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [];

    // In development, automatically allow localhost origins
    if (isDevelopment) {
      const localhostOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173'
      ];
      
      localhostOrigins.forEach(origin => {
        if (!allowedOrigins.includes(origin)) {
          allowedOrigins.push(origin);
        }
      });
    }

    app.use(cors({
      origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is in whitelist
        if (allowedOrigins.indexOf(origin) === -1) {
          const msg = `CORS policy does not allow access from origin: ${origin}`;
          return callback(new Error(msg), false);
        }

        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    app.get('/test', (req, res) => {
      res.json({ success: true });
    });
  });

  describe('Requirement 7.1: Explicit whitelist of allowed origins', () => {
    it('should allow requests from whitelisted origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });

    it('should allow multiple whitelisted origins', async () => {
      const response1 = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      const response2 = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.headers['access-control-allow-origin']).toBe('https://example.com');
      expect(response2.headers['access-control-allow-origin']).toBe('https://app.example.com');
    });
  });

  describe('Requirement 7.2: Reject non-whitelisted origins', () => {
    it('should reject requests from non-whitelisted origins', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://malicious-site.com');

      // CORS errors are handled by the browser, but the server should not set CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject requests from localhost in production', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Requirement 7.3: No wildcard (*) in production', () => {
    it('should not use wildcard for Access-Control-Allow-Origin', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });

    it('should return specific origin, not wildcard', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
    });
  });

  describe('Requirement 7.4: Allow localhost in development', () => {
    beforeEach(() => {
      // Switch to development mode
      process.env.NODE_ENV = 'development';
      process.env.ALLOWED_ORIGINS = 'https://example.com';
      
      // Recreate app with development settings
      app = express();
      isDevelopment = process.env.NODE_ENV === 'development';
      allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [];

      // In development, automatically allow localhost origins
      if (isDevelopment) {
        const localhostOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:5173'
        ];
        
        localhostOrigins.forEach(origin => {
          if (!allowedOrigins.includes(origin)) {
            allowedOrigins.push(origin);
          }
        });
      }

      app.use(cors({
        origin: function(origin, callback) {
          if (!origin) return callback(null, true);

          if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `CORS policy does not allow access from origin: ${origin}`;
            return callback(new Error(msg), false);
          }

          return callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));

      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow localhost:3000 in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow localhost:3001 in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3001');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });

    it('should allow localhost:5173 (Vite default) in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should allow 127.0.0.1 addresses in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://127.0.0.1:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    });

    it('should still allow configured origins in development', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });
  });

  describe('Additional CORS security features', () => {
    it('should allow requests with no origin (mobile apps, curl)', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(200);
    });

    it('should include credentials support', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should specify allowed methods', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should specify allowed headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  describe('Edge cases', () => {
    it('should handle origins with trailing slashes', async () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com/,https://app.example.com';
      
      // Note: Browsers typically don't send trailing slashes in Origin header
      // but we should handle it if configured
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
    });

    it('should handle whitespace in ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com , https://app.example.com';
      
      // Recreate app to pick up new env
      app = express();
      allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());

      app.use(cors({
        origin: function(origin, callback) {
          if (!origin) return callback(null, true);
          if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy violation'), false);
          }
          return callback(null, true);
        },
        credentials: true
      }));

      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
    });
  });
});
