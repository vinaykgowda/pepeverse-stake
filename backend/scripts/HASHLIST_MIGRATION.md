# Hashlist Migration Tool

## Overview

This tool migrates collection hashlists from JSON array format to newline-separated format, as specified in Requirement 15.5.

## Why Migrate?

The platform is standardizing on newline-separated format for hashlists because:

1. **Simplicity**: Easier to read, edit, and validate
2. **Performance**: Faster parsing for large hashlists
3. **Consistency**: Single format across the entire platform (Requirement 15.1)
4. **Validation**: Built-in validation ensures all addresses are valid Solana addresses (Requirements 15.2, 15.4)

## Format Comparison

### Old Format (JSON Array)
```json
["DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x","7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU","AKEWE7Bgh87GPvZbABgaBi2pzqUKbeT7rRvqBvBNqRqN"]
```

### New Format (Newline-Separated)
```
DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
AKEWE7Bgh87GPvZbABgaBi2pzqUKbeT7rRvqBvBNqRqN
```

## Usage

### Dry Run (Recommended First Step)

Preview what will be changed without making any modifications:

```bash
node scripts/migrate-hashlists.js --dry-run
```

### Migrate All Collections

Convert all JSON hashlists to newline-separated format:

```bash
node scripts/migrate-hashlists.js
```

### Migrate Specific Collection

Convert only a specific collection by ID:

```bash
node scripts/migrate-hashlists.js --collection-id=1
```

### Dry Run for Specific Collection

Preview changes for a specific collection:

```bash
node scripts/migrate-hashlists.js --dry-run --collection-id=1
```

## What the Tool Does

1. **Identifies Format**: Detects whether each hashlist is in JSON or newline-separated format
2. **Validates**: Ensures all addresses are valid Solana addresses (base58, 32 bytes)
3. **Converts**: Transforms JSON arrays to newline-separated format
4. **Normalizes**: Removes duplicates and normalizes addresses to base58 format
5. **Updates**: Saves the converted hashlist back to the database

## Output

The tool provides detailed output for each collection:

```
🔄 Starting hashlist migration...

📊 Found 3 collection(s) to process

📦 Processing collection: My NFT Collection (ID: 1)
  📋 Found JSON array with 150 addresses
  ✅ Converted to newline format (150 valid addresses)
  💾 Database updated

📦 Processing collection: Another Collection (ID: 2)
  ✅ Already in newline-separated format (200 addresses)

📦 Processing collection: Third Collection (ID: 3)
  📋 Found JSON array with 75 addresses
  ✅ Converted to newline format (75 valid addresses)
  💾 Database updated

============================================================
📊 Migration Summary:
============================================================
✅ Migrated:  2
⏭️  Skipped:   1
❌ Errors:    0
📦 Total:     3

✨ Migration complete!
```

## Error Handling

The tool handles various error scenarios:

- **Invalid Addresses**: Reports line numbers and specific validation errors
- **Duplicate Addresses**: Detects and reports duplicate entries
- **Malformed JSON**: Catches JSON parsing errors
- **Empty Hashlists**: Skips collections with no hashlist data

Example error output:

```
📦 Processing collection: Problem Collection (ID: 4)
  📋 Found JSON array with 100 addresses
  ❌ Validation failed after conversion:
     - Line 15: Invalid Solana address "invalid_address_here"
     - Line 42: Duplicate address "DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x"
```

## Safety Features

1. **Dry Run Mode**: Test the migration without making changes
2. **Validation**: All addresses are validated before and after conversion
3. **Skips Valid Data**: Collections already in newline format are not modified
4. **Detailed Logging**: Every step is logged for transparency
5. **Error Isolation**: Errors in one collection don't stop the entire migration

## Requirements Satisfied

- ✅ **15.1**: Support exactly one hashlist format (newline-separated)
- ✅ **15.2**: Validate each line is a valid Solana address
- ✅ **15.3**: Reject hashlists containing invalid addresses with descriptive error
- ✅ **15.4**: Normalize all addresses to base58 format
- ✅ **15.5**: Provide migration tool to convert JSON hashlists to newline format

## Rollback

If you need to rollback, you can:

1. Restore from database backup
2. Manually convert back to JSON format if needed

It's recommended to backup your database before running the migration:

```bash
# Example for MySQL
mysqldump -u username -p database_name collections > collections_backup.sql
```

## Testing

Before running in production:

1. Run with `--dry-run` to preview changes
2. Test on a single collection first: `--collection-id=1`
3. Verify the collection works correctly in the application
4. Then migrate all collections

## Support

If you encounter issues:

1. Check the error messages in the output
2. Verify your database connection is working
3. Ensure all addresses in your hashlists are valid Solana addresses
4. Review the validation errors for specific line numbers

## Example Workflow

```bash
# Step 1: Preview all changes
node scripts/migrate-hashlists.js --dry-run

# Step 2: Test on one collection
node scripts/migrate-hashlists.js --collection-id=1

# Step 3: Verify in application that collection 1 works

# Step 4: Migrate all collections
node scripts/migrate-hashlists.js

# Step 5: Verify all collections work correctly
```
