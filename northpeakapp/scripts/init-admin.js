// scripts/init-admin.js — create or reset the single admin user.
// Usage: node scripts/init-admin.js <username> <password>
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from '../src/db.js';

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node scripts/init-admin.js <username> <password>');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Choose a password of at least 10 characters.');
  process.exit(1);
}

await db.init();
const hash = await bcrypt.hash(password, 12);
await db.createAdmin(username, hash);
console.log(`Admin "${username}" created/updated.`);
process.exit(0);
