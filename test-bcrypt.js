const bcrypt = require('bcrypt');

async function test() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Generated hash:', hash);
  
  const match = await bcrypt.compare(password, hash);
  console.log('Verification:', match);
  
  // Test with the hash from database
  const dbHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  const dbMatch = await bcrypt.compare(password, dbHash);
  console.log('DB hash match:', dbMatch);
}

test();
