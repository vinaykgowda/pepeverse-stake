// backend/scripts/encrypt-existing-private-keys.js

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Try to load .env from multiple possible locations
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.log('⚠️ Could not load .env file, trying process.env directly...');
}

// Debug environment variables
console.log('🔍 Environment check:');
console.log('ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);
console.log('ENCRYPTION_KEY length:', process.env.ENCRYPTION_KEY ? process.env.ENCRYPTION_KEY.length : 0);
console.log('DB_HOST:', process.env.DB_HOST ? 'set' : 'not set');
console.log('DB_NAME:', process.env.DB_NAME ? 'set' : 'not set');

const { encryptPrivateKey } = require('../src/solana-transaction-utils');

// NO FALLBACK VALUES - All values must be provided via environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Validate required database configuration
const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);

if (missingDbVars.length > 0) {
  console.error('ERROR: Missing required database environment variables:');
  missingDbVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('\nPlease ensure all required variables are set in your .env file.');
  process.exit(1);
}

async function encryptExistingPrivateKeys() {
  try {
    if (!process.env.ENCRYPTION_KEY) {
      console.error('❌ ENCRYPTION_KEY environment variable is required!');
      console.error('Please add ENCRYPTION_KEY=your-secret-key to your .env file');
      console.error('Current .env file should be at:', path.join(__dirname, '../.env'));
      process.exit(1);
    }

    console.log('🔐 ENCRYPTION_KEY found, length:', process.env.ENCRYPTION_KEY.length);

    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Get current private key setting
    const [settings] = await connection.query(
      'SELECT key_name, value FROM settings WHERE key_name = ?',
      ['rewards_wallet_encrypted_key']
    );

    if (settings.length === 0) {
      console.log('ℹ️ No private key found in settings');
      await connection.end();
      return;
    }

    const currentValue = settings[0].value;

    if (!currentValue) {
      console.log('ℹ️ Private key setting exists but is empty');
      await connection.end();
      return;
    }

    // Check if already encrypted (contains colon separator)
    if (currentValue.includes(':')) {
      console.log('✅ Private key is already encrypted');
      await connection.end();
      return;
    }

    console.log('🔐 Encrypting existing private key...');
    console.log('Current value length:', currentValue.length);

    // Encrypt the existing private key
    const encryptedKey = encryptPrivateKey(currentValue);

    // Update the database
    await connection.query(
      'UPDATE settings SET value = ? WHERE key_name = ?',
      [encryptedKey, 'rewards_wallet_encrypted_key']
    );

    console.log('✅ Private key encrypted and updated successfully');
    console.log('New encrypted value length:', encryptedKey.length);

    await connection.end();

  } catch (error) {
    console.error('❌ Failed to encrypt private key:', error);
    process.exit(1);
  }
}

encryptExistingPrivateKeys();