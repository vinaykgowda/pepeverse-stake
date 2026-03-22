const bcrypt = require('bcrypt');

const password = 'admin123';
const hash = '$2b$10$plTfgyX8OjvHRyl.yGi8ke4uWqlSoR8W5ZPy84KavRbgBE.HZsGOe';

bcrypt.compare(password, hash).then(match => {
  console.log('Password match:', match);
});
