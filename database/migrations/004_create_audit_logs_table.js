/**
 * Migration: Create audit_logs table for administrative actions
 * 
 * This migration creates the audit_logs table to track all administrative actions
 * for compliance and security purposes. The table includes:
 * - Basic audit information (admin_id, action, entity details)
 * - Change tracking (old_value, new_value as JSON)
 * - Request metadata (ip_address, user_agent)
 * - Timestamp for when the action occurred
 * 
 * The migration is idempotent and can be safely run multiple times.
 */

/**
 * Apply the migration (up)
 */
async function up(connection) {
  console.log('Starting migration: 004_create_audit_logs_table');
  
  await connection.beginTransaction();
  
  try {
    // Check if audit_logs table already exists
    console.log('Checking if audit_logs table exists...');
    const [tables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
    `);
    
    if (tables[0].count === 0) {
      console.log('Creating audit_logs table...');
      await connection.query(`
        CREATE TABLE audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          admin_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INT,
          old_value JSON,
          new_value JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
          INDEX idx_audit_logs_admin (admin_id),
          INDEX idx_audit_logs_created (created_at),
          INDEX idx_audit_logs_entity (entity_type, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('✓ Created audit_logs table');
    } else {
      console.log('✓ audit_logs table already exists');
      
      // Verify the table has all required columns
      console.log('Verifying table structure...');
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'audit_logs'
        ORDER BY ORDINAL_POSITION
      `);
      
      const columnNames = columns.map(c => c.COLUMN_NAME);
      const requiredColumns = [
        'id', 'admin_id', 'action', 'entity_type', 'entity_id',
        'old_value', 'new_value', 'ip_address', 'user_agent', 'created_at'
      ];
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      if (missingColumns.length > 0) {
        throw new Error(`audit_logs table is missing columns: ${missingColumns.join(', ')}`);
      }
      
      console.log('✓ Table structure verified');
    }
    
    // Verify foreign key constraint exists
    console.log('Verifying foreign key constraint...');
    const [foreignKeys] = await connection.query(`
      SELECT CONSTRAINT_NAME, DELETE_RULE
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
        AND REFERENCED_TABLE_NAME = 'admins'
    `);
    
    if (foreignKeys.length === 0) {
      console.log('Adding foreign key constraint...');
      await connection.query(`
        ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_admin_fk
        FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
      `);
      console.log('✓ Added foreign key constraint');
    } else {
      console.log(`✓ Foreign key constraint exists (${foreignKeys[0].CONSTRAINT_NAME}, ON DELETE ${foreignKeys[0].DELETE_RULE})`);
    }
    
    // Verify indexes exist
    console.log('Verifying indexes...');
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as columns
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
        AND INDEX_NAME != 'PRIMARY'
      GROUP BY INDEX_NAME
      ORDER BY INDEX_NAME
    `);
    
    const indexMap = {};
    for (const index of indexes) {
      indexMap[index.INDEX_NAME] = index.columns;
    }
    
    // Check for required indexes
    const requiredIndexes = {
      'idx_audit_logs_admin': 'admin_id',
      'idx_audit_logs_created': 'created_at',
      'idx_audit_logs_entity': 'entity_type, entity_id'
    };
    
    for (const [indexName, expectedColumns] of Object.entries(requiredIndexes)) {
      if (!indexMap[indexName]) {
        console.log(`Creating index ${indexName}...`);
        if (indexName === 'idx_audit_logs_entity') {
          await connection.query(`
            CREATE INDEX ${indexName} ON audit_logs(entity_type, entity_id)
          `);
        } else {
          const columnName = expectedColumns;
          await connection.query(`
            CREATE INDEX ${indexName} ON audit_logs(${columnName})
          `);
        }
        console.log(`✓ Created ${indexName}`);
      } else {
        console.log(`✓ Index ${indexName} exists (${indexMap[indexName]})`);
      }
    }
    
    // Final verification
    console.log('\nVerifying migration changes...');
    const [verifyTable] = await connection.query(`
      SELECT 
        TABLE_NAME,
        ENGINE,
        TABLE_COLLATION
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
    `);
    
    if (verifyTable.length === 0) {
      throw new Error('Migration verification failed: audit_logs table not found');
    }
    
    console.log('\nTable details:');
    console.log(`  Engine: ${verifyTable[0].ENGINE}`);
    console.log(`  Collation: ${verifyTable[0].TABLE_COLLATION}`);
    
    const [verifyColumns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColumns:');
    for (const col of verifyColumns) {
      console.log(`  ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
    }
    
    const [verifyIndexes] = await connection.query(`
      SELECT 
        INDEX_NAME,
        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') as columns,
        NON_UNIQUE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
      GROUP BY INDEX_NAME, NON_UNIQUE
      ORDER BY INDEX_NAME
    `);
    
    console.log('\nIndexes:');
    for (const idx of verifyIndexes) {
      const type = idx.NON_UNIQUE === 0 ? 'UNIQUE' : 'INDEX';
      console.log(`  ${idx.INDEX_NAME} (${type}): ${idx.columns}`);
    }
    
    console.log('\n✓ Migration verification successful');
    
    await connection.commit();
    console.log('Migration completed successfully');
    
    return {
      success: true,
      message: 'Migration 004_create_audit_logs_table completed successfully'
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
  console.log('Starting rollback: 004_create_audit_logs_table');
  
  await connection.beginTransaction();
  
  try {
    // Check if audit_logs table exists
    console.log('Checking if audit_logs table exists...');
    const [tables] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
    `);
    
    if (tables[0].count > 0) {
      console.log('Dropping audit_logs table...');
      await connection.query(`DROP TABLE audit_logs`);
      console.log('✓ Dropped audit_logs table');
    } else {
      console.log('✓ audit_logs table does not exist');
    }
    
    await connection.commit();
    console.log('Rollback completed successfully');
    
    return {
      success: true,
      message: 'Rollback 004_create_audit_logs_table completed successfully'
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
