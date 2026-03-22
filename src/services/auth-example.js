/**
 * Example Usage of Authentication Service
 * 
 * This file demonstrates how to use the AuthService for wallet-based authentication.
 * 
 * Prerequisites:
 * - Redis server running on localhost:6379
 * - Run: npm install
 * 
 * Usage:
 * - node backend/src/services/auth-example.js
 */

const authService = require('./auth');
const redisManager = require('../config/redis');

async function demonstrateAuthService() {
  console.log('=== Authentication Service Example ===\n');

  try {
    // Initialize Redis
    console.log('1. Initializing Redis connection...');
    await redisManager.initialize();
    console.log('   ✓ Redis connected\n');

    // Example wallet address
    const walletAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
    console.log(`2. Using wallet address: ${walletAddress}\n`);

    // Validate wallet address
    console.log('3. Validating wallet address...');
    const isValid = authService.isValidSolanaAddress(walletAddress);
    console.log(`   ✓ Address is valid: ${isValid}\n`);

    // Generate nonce
    console.log('4. Generating nonce...');
    const nonce = await authService.generateNonce(walletAddress);
    console.log(`   ✓ Nonce generated: ${nonce}`);
    console.log(`   ✓ Nonce length: ${nonce.length} characters\n`);

    // Check if nonce exists
    console.log('5. Checking if nonce exists...');
    const exists = await authService.hasNonce(walletAddress);
    console.log(`   ✓ Nonce exists: ${exists}\n`);

    // Get nonce TTL
    console.log('6. Getting nonce TTL...');
    const ttl = await authService.getNonceTTL(walletAddress);
    console.log(`   ✓ Nonce TTL: ${ttl} seconds (${Math.floor(ttl / 60)} minutes)\n`);

    // Retrieve nonce
    console.log('7. Retrieving nonce from Redis...');
    const retrievedNonce = await authService.getNonce(walletAddress);
    console.log(`   ✓ Retrieved nonce: ${retrievedNonce}`);
    console.log(`   ✓ Nonces match: ${nonce === retrievedNonce}\n`);

    // Wait 2 seconds to demonstrate TTL decrease
    console.log('8. Waiting 2 seconds to demonstrate TTL decrease...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newTtl = await authService.getNonceTTL(walletAddress);
    console.log(`   ✓ New TTL: ${newTtl} seconds`);
    console.log(`   ✓ TTL decreased by: ${ttl - newTtl} seconds\n`);

    // Generate another nonce (should be different)
    console.log('9. Generating another nonce...');
    const nonce2 = await authService.generateNonce(walletAddress);
    console.log(`   ✓ New nonce: ${nonce2}`);
    console.log(`   ✓ Nonces are different: ${nonce !== nonce2}\n`);

    // Delete nonce
    console.log('10. Deleting nonce...');
    const deleted = await authService.deleteNonce(walletAddress);
    console.log(`   ✓ Nonce deleted: ${deleted}\n`);

    // Check if nonce still exists
    console.log('11. Checking if nonce still exists...');
    const stillExists = await authService.hasNonce(walletAddress);
    console.log(`   ✓ Nonce exists: ${stillExists}\n`);

    // Try to retrieve deleted nonce
    console.log('12. Trying to retrieve deleted nonce...');
    const deletedNonce = await authService.getNonce(walletAddress);
    console.log(`   ✓ Retrieved nonce: ${deletedNonce === null ? 'null (as expected)' : deletedNonce}\n`);

    // Test invalid wallet address
    console.log('13. Testing invalid wallet address...');
    try {
      await authService.generateNonce('invalid-address');
      console.log('   ✗ Should have thrown error');
    } catch (error) {
      console.log(`   ✓ Error caught: ${error.message}\n`);
    }

    // Test concurrent nonce generation
    console.log('14. Testing concurrent nonce generation...');
    const wallets = [
      '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      '8FdEhTZHyXztcszZFq46LIO9wwx4twBvMLUaYxDGMuW',
      '9GeEiUAIzYuudtaAGr57MJP0xxy5uxCwNMVbZyEHNvX'
    ];
    
    const promises = wallets.map(wallet => authService.generateNonce(wallet));
    const nonces = await Promise.all(promises);
    
    console.log(`   ✓ Generated ${nonces.length} nonces concurrently`);
    const uniqueNonces = new Set(nonces);
    console.log(`   ✓ All nonces are unique: ${uniqueNonces.size === nonces.length}\n`);

    // Clean up
    console.log('15. Cleaning up...');
    for (const wallet of wallets) {
      await authService.deleteNonce(wallet);
    }
    console.log('   ✓ All test nonces deleted\n');

    console.log('=== Example Complete ===');
    console.log('\nNext Steps:');
    console.log('- Implement signature verification (Task 4.3)');
    console.log('- Create API endpoints for nonce generation');
    console.log('- Integrate with authentication middleware');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Ensure Redis is running: redis-cli ping');
    console.error('- Check Redis connection settings in .env');
    console.error('- Verify Redis is accessible on localhost:6379');
  } finally {
    // Close Redis connections
    await redisManager.close();
    console.log('\n✓ Redis connections closed');
  }
}

// Run the example
if (require.main === module) {
  demonstrateAuthService()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateAuthService };
