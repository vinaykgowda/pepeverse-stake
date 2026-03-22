/**
 * Migration: Add CASCADE rules to foreign key constraints
 * 
 * This migration updates foreign key constraints to include CASCADE rules:
 * - staked_nfts.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE
 * - collection_rewards.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE
 * - trait_rewards.collection_id: ON DELETE CASCADE, ON UPDATE CASCADE
 * - transactions.collection_id: ON DELETE SET NULL, ON UPDATE CASCADE (already added in 001)
 * 
 * The migration is idempotent and can be safely run multiple times.
 */

const mysql = require('mysql2/promise');

/**
 * Apply the migration (up)
 */
async function up(connection) {
  console.log('Starting migration: 002_add_cascade_foreign_keys');
  
  await connection.beginTransaction();
  
  try {
    // Update staked_nfts foreign key with CASCADE rules
    console.log('Updating staked_nfts foreign key constraint...');
    
    // Check if the foreign key exists
    const [stakedNftsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (stakedNftsFk.length > 0) {
      const constraintName = stakedNftsFk[0].CONSTRAINT_NAME;
      
      // Check current CASCADE rules
      const [currentRules] = await connection.query(`
        SELECT DELETE_RULE, UPDATE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = ?
          AND TABLE_NAME = 'staked_nfts'
      `, [constraintName]);
      
      if (currentRules.length > 0 && 
          (currentRules[0].DELETE_RULE !== 'CASCADE' || currentRules[0].UPDATE_RULE !== 'CASCADE')) {
        console.log(`Dropping existing constraint ${constraintName}...`);
        await connection.query(`
          ALTER TABLE staked_nfts 
          DROP FOREIGN KEY ${constraintName}
        `);
        
        console.log('Adding new constraint with CASCADE rules...');
        await connection.query(`
          ALTER TABLE staked_nfts
          ADD CONSTRAINT staked_nfts_collection_fk
          FOREIGN KEY (collection_id)
          REFERENCES collections(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
        `);
        console.log('✓ Updated staked_nfts foreign key constraint');
      } else {
        console.log('✓ staked_nfts foreign key already has CASCADE rules');
      }
    } else {
      // Foreign key doesn't exist, create it with CASCADE rules
      console.log('Creating staked_nfts foreign key with CASCADE rules...');
      await connection.query(`
        ALTER TABLE staked_nfts
        ADD CONSTRAINT staked_nfts_collection_fk
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
      console.log('✓ Created staked_nfts foreign key constraint');
    }
    
    // Update collection_rewards foreign key with CASCADE rules
    console.log('Updating collection_rewards foreign key constraint...');
    
    const [collectionRewardsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'collection_rewards' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (collectionRewardsFk.length > 0) {
      const constraintName = collectionRewardsFk[0].CONSTRAINT_NAME;
      
      // Check current CASCADE rules
      const [currentRules] = await connection.query(`
        SELECT DELETE_RULE, UPDATE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = ?
          AND TABLE_NAME = 'collection_rewards'
      `, [constraintName]);
      
      if (currentRules.length > 0 && 
          (currentRules[0].DELETE_RULE !== 'CASCADE' || currentRules[0].UPDATE_RULE !== 'CASCADE')) {
        console.log(`Dropping existing constraint ${constraintName}...`);
        await connection.query(`
          ALTER TABLE collection_rewards 
          DROP FOREIGN KEY ${constraintName}
        `);
        
        console.log('Adding new constraint with CASCADE rules...');
        await connection.query(`
          ALTER TABLE collection_rewards
          ADD CONSTRAINT collection_rewards_collection_fk
          FOREIGN KEY (collection_id)
          REFERENCES collections(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
        `);
        console.log('✓ Updated collection_rewards foreign key constraint');
      } else {
        console.log('✓ collection_rewards foreign key already has CASCADE rules');
      }
    } else {
      // Foreign key doesn't exist, create it with CASCADE rules
      console.log('Creating collection_rewards foreign key with CASCADE rules...');
      await connection.query(`
        ALTER TABLE collection_rewards
        ADD CONSTRAINT collection_rewards_collection_fk
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
      console.log('✓ Created collection_rewards foreign key constraint');
    }
    
    // Update trait_rewards foreign key with CASCADE rules
    console.log('Updating trait_rewards foreign key constraint...');
    
    const [traitRewardsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'trait_rewards' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (traitRewardsFk.length > 0) {
      const constraintName = traitRewardsFk[0].CONSTRAINT_NAME;
      
      // Check current CASCADE rules
      const [currentRules] = await connection.query(`
        SELECT DELETE_RULE, UPDATE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = ?
          AND TABLE_NAME = 'trait_rewards'
      `, [constraintName]);
      
      if (currentRules.length > 0 && 
          (currentRules[0].DELETE_RULE !== 'CASCADE' || currentRules[0].UPDATE_RULE !== 'CASCADE')) {
        console.log(`Dropping existing constraint ${constraintName}...`);
        await connection.query(`
          ALTER TABLE trait_rewards 
          DROP FOREIGN KEY ${constraintName}
        `);
        
        console.log('Adding new constraint with CASCADE rules...');
        await connection.query(`
          ALTER TABLE trait_rewards
          ADD CONSTRAINT trait_rewards_collection_fk
          FOREIGN KEY (collection_id)
          REFERENCES collections(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
        `);
        console.log('✓ Updated trait_rewards foreign key constraint');
      } else {
        console.log('✓ trait_rewards foreign key already has CASCADE rules');
      }
    } else {
      // Foreign key doesn't exist, create it with CASCADE rules
      console.log('Creating trait_rewards foreign key with CASCADE rules...');
      await connection.query(`
        ALTER TABLE trait_rewards
        ADD CONSTRAINT trait_rewards_collection_fk
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
      console.log('✓ Created trait_rewards foreign key constraint');
    }
    
    // Verify all changes
    console.log('Verifying migration changes...');
    
    const [verifyConstraints] = await connection.query(`
      SELECT 
        rc.TABLE_NAME,
        rc.CONSTRAINT_NAME,
        rc.DELETE_RULE,
        rc.UPDATE_RULE,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
        AND rc.TABLE_NAME IN ('staked_nfts', 'collection_rewards', 'trait_rewards')
        AND kcu.REFERENCED_TABLE_NAME = 'collections'
      ORDER BY rc.TABLE_NAME
    `);
    
    console.log('\nForeign key constraints after migration:');
    for (const constraint of verifyConstraints) {
      console.log(`  ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
      console.log(`    ON DELETE ${constraint.DELETE_RULE}, ON UPDATE ${constraint.UPDATE_RULE}`);
    }
    
    // Verify that all three tables have CASCADE rules
    const cascadeCount = verifyConstraints.filter(c => 
      c.DELETE_RULE === 'CASCADE' && c.UPDATE_RULE === 'CASCADE'
    ).length;
    
    if (cascadeCount < 3) {
      throw new Error('Migration verification failed: not all foreign keys have CASCADE rules');
    }
    
    console.log('\n✓ Migration verification successful');
    
    await connection.commit();
    console.log('Migration completed successfully');
    
    return {
      success: true,
      message: 'Migration 002_add_cascade_foreign_keys completed successfully'
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Migration failed:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration (down)
 */
async function down(connection) {
  console.log('Starting rollback: 002_add_cascade_foreign_keys');
  
  await connection.beginTransaction();
  
  try {
    // Rollback staked_nfts foreign key to no CASCADE
    console.log('Rolling back staked_nfts foreign key constraint...');
    
    const [stakedNftsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staked_nfts' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (stakedNftsFk.length > 0) {
      const constraintName = stakedNftsFk[0].CONSTRAINT_NAME;
      console.log(`Dropping constraint ${constraintName}...`);
      await connection.query(`
        ALTER TABLE staked_nfts 
        DROP FOREIGN KEY ${constraintName}
      `);
      
      console.log('Adding constraint without CASCADE rules...');
      await connection.query(`
        ALTER TABLE staked_nfts
        ADD CONSTRAINT staked_nfts_ibfk_1
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
      `);
      console.log('✓ Rolled back staked_nfts foreign key constraint');
    }
    
    // Rollback collection_rewards foreign key to no CASCADE
    console.log('Rolling back collection_rewards foreign key constraint...');
    
    const [collectionRewardsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'collection_rewards' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (collectionRewardsFk.length > 0) {
      const constraintName = collectionRewardsFk[0].CONSTRAINT_NAME;
      console.log(`Dropping constraint ${constraintName}...`);
      await connection.query(`
        ALTER TABLE collection_rewards 
        DROP FOREIGN KEY ${constraintName}
      `);
      
      console.log('Adding constraint without CASCADE rules...');
      await connection.query(`
        ALTER TABLE collection_rewards
        ADD CONSTRAINT collection_rewards_ibfk_1
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
      `);
      console.log('✓ Rolled back collection_rewards foreign key constraint');
    }
    
    // Rollback trait_rewards foreign key to no CASCADE
    console.log('Rolling back trait_rewards foreign key constraint...');
    
    const [traitRewardsFk] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'trait_rewards' 
        AND COLUMN_NAME = 'collection_id' 
        AND REFERENCED_TABLE_NAME = 'collections'
    `);
    
    if (traitRewardsFk.length > 0) {
      const constraintName = traitRewardsFk[0].CONSTRAINT_NAME;
      console.log(`Dropping constraint ${constraintName}...`);
      await connection.query(`
        ALTER TABLE trait_rewards 
        DROP FOREIGN KEY ${constraintName}
      `);
      
      console.log('Adding constraint without CASCADE rules...');
      await connection.query(`
        ALTER TABLE trait_rewards
        ADD CONSTRAINT trait_rewards_ibfk_1
        FOREIGN KEY (collection_id)
        REFERENCES collections(id)
      `);
      console.log('✓ Rolled back trait_rewards foreign key constraint');
    }
    
    await connection.commit();
    console.log('Rollback completed successfully');
    
    return {
      success: true,
      message: 'Rollback 002_add_cascade_foreign_keys completed successfully'
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Rollback failed:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down
};
