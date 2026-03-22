/**
 * Startup Validation Module
 * 
 * Validates all required environment variables and secrets on application startup.
 * Fails fast with descriptive error messages if any required configuration is missing.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5, 28.1, 28.2, 28.3, 29.3
 */

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Database configuration
  DATABASE_URL: {
    description: 'Neon DB connection string',
    example: 'postgresql://user:password@host.neon.tech/dbname?sslmode=require',
    validator: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://')
  },
  
  // Authentication secrets
  JWT_SECRET: {
    description: 'Secret key for JWT token signing',
    example: 'your-secure-random-jwt-secret-here',
    validator: (value) => value.length >= 32,
    validationError: 'JWT_SECRET must be at least 32 characters long'
  },
  
  // Solana network configuration
  MAINNET_RPC_PRIMARY: {
    description: 'Primary Solana mainnet RPC endpoint',
    example: 'https://api.mainnet-beta.solana.com',
    validator: (value) => value.startsWith('http://') || value.startsWith('https://')
  },
  
  MAINNET_RPC_FALLBACK: {
    description: 'Fallback Solana mainnet RPC endpoint',
    example: 'https://solana-api.projectserum.com',
    validator: (value) => value.startsWith('http://') || value.startsWith('https://')
  },
  
  // Helius API configuration
  HELIUS_MAINNET_ENDPOINT: {
    description: 'Helius mainnet API endpoint',
    example: 'https://mainnet.helius-rpc.com',
    validator: (value) => value.startsWith('http://') || value.startsWith('https://')
  },
  
  HELIUS_API_KEY: {
    description: 'Helius API key for NFT data access',
    example: 'your-helius-api-key',
    validator: (value) => value.length > 0
  },
  
  // Rewards wallet
  REWARDS_WALLET_PRIVATE_KEY: {
    description: 'Private key for rewards distribution wallet',
    example: 'base58-encoded-private-key',
    validator: (value) => value.length > 0,
    sensitive: true
  },
  
  // Server configuration
  PORT: {
    description: 'Server port number',
    example: '3000',
    validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0 && parseInt(value) < 65536,
    validationError: 'PORT must be a valid port number (1-65535)'
  },
  
  // API configuration
  API_BASE_URL: {
    description: 'Base URL for API routes',
    example: '/api',
    validator: (value) => value.startsWith('/')
  }
};

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  NODE_ENV: {
    description: 'Node environment',
    default: 'development',
    validator: (value) => ['development', 'production', 'test'].includes(value)
  },
  
  SOLANA_NETWORK: {
    description: 'Solana network identifier',
    default: 'mainnet',
    validator: (value) => ['mainnet', 'devnet', 'testnet'].includes(value)
  },
  
  ALLOWED_ORIGINS: {
    description: 'Comma-separated list of allowed CORS origins',
    default: '',
    validator: (value) => true // Any value is acceptable
  }
};

/**
 * Validate a single environment variable
 * 
 * @param {string} name - Environment variable name
 * @param {object} config - Variable configuration
 * @returns {object} Validation result { valid: boolean, error?: string }
 */
function validateEnvVar(name, config) {
  const value = process.env[name];
  
  // Check if value exists
  if (!value || value.trim() === '') {
    return {
      valid: false,
      error: `Missing required environment variable: ${name}`,
      details: {
        description: config.description,
        example: config.example
      }
    };
  }
  
  // Run custom validator if provided
  if (config.validator) {
    try {
      const isValid = config.validator(value);
      if (!isValid) {
        return {
          valid: false,
          error: config.validationError || `Invalid value for ${name}`,
          details: {
            description: config.description,
            example: config.example
          }
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Validation error for ${name}: ${error.message}`,
        details: {
          description: config.description,
          example: config.example
        }
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate all required environment variables
 * 
 * @returns {object} Validation result { valid: boolean, errors: array }
 */
function validateEnvironment() {
  const errors = [];
  
  // Validate required variables
  for (const [name, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const result = validateEnvVar(name, config);
    if (!result.valid) {
      errors.push(result);
    }
  }
  
  // Set defaults for optional variables
  for (const [name, config] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[name] || process.env[name].trim() === '') {
      process.env[name] = config.default;
    } else {
      // Validate if value is provided
      const result = validateEnvVar(name, config);
      if (!result.valid) {
        errors.push(result);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Print validation errors in a user-friendly format
 * 
 * @param {array} errors - Array of validation errors
 */
function printValidationErrors(errors) {
  console.error('\n❌ STARTUP VALIDATION FAILED\n');
  console.error('The following required environment variables are missing or invalid:\n');
  
  errors.forEach((error, index) => {
    console.error(`${index + 1}. ${error.error}`);
    if (error.details) {
      console.error(`   Description: ${error.details.description}`);
      console.error(`   Example: ${error.details.example}`);
    }
    console.error('');
  });
  
  console.error('Please ensure all required environment variables are set in your Vercel');
  console.error('project settings or in your .env file for local development.\n');
  console.error('For more information, see the deployment documentation.\n');
}

/**
 * Validate environment and exit if validation fails
 * This is the main function to call on application startup
 */
function validateOrExit() {
  const result = validateEnvironment();
  
  if (!result.valid) {
    printValidationErrors(result.errors);
    process.exit(1);
  }
  
  console.log('✓ Environment validation passed');
  return true;
}

/**
 * Get a summary of loaded configuration (for logging)
 * Redacts sensitive values
 * 
 * @returns {object} Configuration summary
 */
function getConfigSummary() {
  const summary = {};
  
  for (const [name, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[name];
    if (config.sensitive) {
      summary[name] = value ? '[REDACTED]' : '[NOT SET]';
    } else {
      summary[name] = value ? '✓ Set' : '✗ Not set';
    }
  }
  
  for (const [name] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[name];
    summary[name] = value || '[DEFAULT]';
  }
  
  return summary;
}

module.exports = {
  validateEnvironment,
  validateOrExit,
  getConfigSummary,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};
