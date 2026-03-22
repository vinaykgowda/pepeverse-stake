#!/usr/bin/env node

/**
 * Example: Hashlist Migration
 * 
 * This example demonstrates how the migration tool works
 * without requiring a database connection.
 */

const { parseHashlist, serializeHashlist } = require('../src/utils/hashlistParser');

console.log('🔄 Hashlist Migration Example\n');
console.log('='.repeat(60));

// Example 1: JSON Array Format (OLD)
console.log('\n📋 Example 1: Converting JSON Array to Newline Format\n');

const jsonHashlist = JSON.stringify([
  'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x',
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  'AKEWE7Bgh87GPvZbABgaBi2pzqUKbeT7rRvqBvBNqRqN'
]);

console.log('Old Format (JSON):');
console.log(jsonHashlist);

// Parse JSON and convert to newline format
const addresses = JSON.parse(jsonHashlist);
const newlineFormat = serializeHashlist(addresses);

console.log('\nNew Format (Newline-separated):');
console.log(newlineFormat);

// Validate the new format
const validation = parseHashlist(newlineFormat);
console.log(`\n✅ Validation: ${validation.success ? 'PASSED' : 'FAILED'}`);
console.log(`   Addresses: ${validation.addresses.length}`);

// Example 2: Already in Newline Format
console.log('\n' + '='.repeat(60));
console.log('\n📋 Example 2: Already in Newline Format (No Change Needed)\n');

const existingNewlineFormat = `DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
AKEWE7Bgh87GPvZbABgaBi2pzqUKbeT7rRvqBvBNqRqN`;

console.log('Format:');
console.log(existingNewlineFormat);

const validation2 = parseHashlist(existingNewlineFormat);
console.log(`\n✅ Validation: ${validation2.success ? 'PASSED' : 'FAILED'}`);
console.log(`   Addresses: ${validation2.addresses.length}`);
console.log('   Status: Already in correct format, no migration needed');

// Example 3: Invalid Addresses
console.log('\n' + '='.repeat(60));
console.log('\n📋 Example 3: Detecting Invalid Addresses\n');

const invalidHashlist = `DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x
invalid_address_here
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`;

console.log('Format with invalid address:');
console.log(invalidHashlist);

const validation3 = parseHashlist(invalidHashlist);
console.log(`\n❌ Validation: ${validation3.success ? 'PASSED' : 'FAILED'}`);
if (!validation3.success) {
  console.log('   Errors:');
  validation3.errors.forEach(err => console.log(`   - ${err}`));
}

// Example 4: Duplicate Detection
console.log('\n' + '='.repeat(60));
console.log('\n📋 Example 4: Detecting Duplicate Addresses\n');

const duplicateHashlist = `DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x`;

console.log('Format with duplicate:');
console.log(duplicateHashlist);

const validation4 = parseHashlist(duplicateHashlist);
console.log(`\n❌ Validation: ${validation4.success ? 'PASSED' : 'FAILED'}`);
if (!validation4.success) {
  console.log('   Errors:');
  validation4.errors.forEach(err => console.log(`   - ${err}`));
}

console.log('\n' + '='.repeat(60));
console.log('\n✨ Examples complete!\n');
console.log('To migrate your database, run:');
console.log('  node scripts/migrate-hashlists.js --dry-run\n');
