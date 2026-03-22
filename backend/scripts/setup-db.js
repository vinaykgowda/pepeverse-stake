// backend/scripts/setup-db.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection configuration
// NO FALLBACK VALUES - All values must be provided via environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true
};

// Validate required database configuration
const requiredDbVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
const missingDbVars = requiredDbVars.filter(varName => !process.env[varName]);

if (missingDbVars.length > 0) {
  console.error('ERROR: Missing required database environment variables:');
  missingDbVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('\nPlease ensure all required variables are set in your .env file.');
  process.exit(1);
}

async function setupDatabase() {
  try {
    // Create connection
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server successfully');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME;
    if (!dbName) {
      throw new Error('DB_NAME environment variable is required');
    }
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`Database '${dbName}' created or already exists`);

    // Use the database
    await connection.query(`USE ${dbName}`);
    console.log(`Using database '${dbName}'`);

    // Read schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('Applying database schema...');
    await connection.query(schema);
    console.log('Database schema applied successfully');

    // Check if super admin exists
    const [admins] = await connection.query('SELECT * FROM admins WHERE is_super_admin = TRUE');

    if (admins.length === 0 && process.env.ADMIN_WALLET) {
      // Insert super admin if provided
      await connection.query(
        'INSERT INTO admins (wallet_address, username, is_super_admin) VALUES (?, ?, TRUE)',
        [process.env.ADMIN_WALLET, 'Super Admin']
      );
      console.log(`Super admin created with wallet: ${process.env.ADMIN_WALLET}`);
    }

    // Close connection
    await connection.end();
    console.log('Database setup completed');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase();