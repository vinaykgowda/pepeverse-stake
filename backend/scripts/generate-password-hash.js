// Generate bcrypt password hash
// Usage: node scripts/generate-password-hash.js <password>

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin123';

bcrypt.hash(password, 10).then(hash => {
  console.log('\n=================================');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('=================================\n');
  console.log('SQL to update admin password:');
  console.log(`UPDATE admins SET password = '${hash}' WHERE username = 'admin';`);
  console.log('\n');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
