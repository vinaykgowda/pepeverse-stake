#!/usr/bin/env node

/**
 * Hashlist Migration Tool
 * 
 * Converts JSON array hashlists to newline-separated format
 * Requirement: 15.5 - Provide migration tool to convert JSON hashlists to newline format
 * 
 * Usage:
 *   node scripts/migrate-hashlists.js [--dry-run] [--collection-id=<id>]
 * 
 * Options:
 *   --dry-run         Show what would be changed without making changes
 *   --collection-id   Migrate only a specific collection by ID
 */

const { getPool } = require('../src/db');
const { parseHashlist, serializeHashlist } = require('../src/utils/hashlistParser');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const collectionIdArg = args.find(arg => arg.startsWith('--collection-id='));
const specificCollectionId = collectionIdArg ? collectionIdArg.split('=')[1] : null;

async function migrateHashlists() {
  const pool = getPool();
  const connection = pool.promise();

  try {
    console.log('🔄 Starting hashlist migration...\n');
    
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Build query based on whether we're migrating a specific collection
    let query = 'SELECT id, name, hashlist FROM collections';
    const params = [];
    
    if (specificCollectionId) {
      query += ' WHERE id = ?';
      params.push(specificCollectionId);
      console.log(`🎯 Migrating only collection ID: ${specificCollectionId}\n`);
    }

    const [collections] = await connection.query(query, params);

    if (collections.length === 0) {
      console.log('❌ No collections found to migrate');
      return;
    }

    console.log(`📊 Found ${collections.length} collection(s) to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const collection of collections) {
      console.log(`\n📦 Processing collection: ${collection.name} (ID: ${collection.id})`);
      
      const hashlistString = collection.hashlist;
      
      if (!hashlistString) {
        console.log('  ⚠️  Empty hashlist, skipping');
        skippedCount++;
        continue;
      }

      // Check if it's already in newline-separated format
      const isNewlineFormat = !hashlistString.trim().startsWith('[') && 
                              !hashlistString.trim().startsWith('{');

      if (isNewlineFormat) {
        // Validate it's a valid newline-separated format
        const result = parseHashlist(hashlistString);
        
        if (result.success) {
          console.log(`  ✅ Already in newline-separated format (${result.addresses.length} addresses)`);
          skippedCount++;
          continue;
        } else {
          console.log('  ⚠️  Appears to be newline format but has validation errors:');
          result.errors.forEach(err => console.log(`     - ${err}`));
          errorCount++;
          continue;
        }
      }

      // Try to parse as JSON
      try {
        const jsonData = JSON.parse(hashlistString);
        
        if (!Array.isArray(jsonData)) {
          console.log('  ❌ Hashlist is JSON but not an array, skipping');
          errorCount++;
          continue;
        }

        console.log(`  📋 Found JSON array with ${jsonData.length} addresses`);

        // Convert to newline-separated format
        let newlineFormat;
        try {
          newlineFormat = serializeHashlist(jsonData);
        } catch (error) {
          console.log(`  ❌ Error converting to newline format: ${error.message}`);
          errorCount++;
          continue;
        }

        // Validate the new format
        const validationResult = parseHashlist(newlineFormat);
        
        if (!validationResult.success) {
          console.log('  ❌ Validation failed after conversion:');
          validationResult.errors.forEach(err => console.log(`     - ${err}`));
          errorCount++;
          continue;
        }

        console.log(`  ✅ Converted to newline format (${validationResult.addresses.length} valid addresses)`);

        // Update the database
        if (!dryRun) {
          await connection.query(
            'UPDATE collections SET hashlist = ? WHERE id = ?',
            [newlineFormat, collection.id]
          );
          console.log('  💾 Database updated');
        } else {
          console.log('  🔍 Would update database (dry run)');
        }

        migratedCount++;

      } catch (jsonError) {
        console.log(`  ❌ Error parsing JSON: ${jsonError.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Migrated:  ${migratedCount}`);
    console.log(`⏭️  Skipped:   ${skippedCount}`);
    console.log(`❌ Errors:    ${errorCount}`);
    console.log(`📦 Total:     ${collections.length}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply changes');
    }

    console.log('\n✨ Migration complete!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateHashlists()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
