// scripts/init-admin.js — create or reset the admin login.
// Usage: npm run init-admin -- <username> <password>
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from '../src/db.js';

const [, , username, password] = process.argv;
if (!username || !password) { console.error('Usage: npm run init-admin -- <username> <password>'); process.exit(1); }
if (password.length < 10) { console.error('Choose a password of at least 10 characters.'); process.exit(1); }
await db.init();
await db.createAdmin(username, await bcrypt.hash(password, 12));
console.log(`Admin "${username}" is ready. Sign in at /admin`);
process.exit(0);
