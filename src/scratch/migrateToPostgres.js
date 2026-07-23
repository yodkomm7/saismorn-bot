// One-time migration: import existing db.json (users/bills) into Postgres.
// Usage: node src/scratch/migrateToPostgres.js
// Requires DATABASE_URL to be set in .env, pointing at the target Postgres instance.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DB_JSON_PATH = path.join(__dirname, '..', '..', 'db.json');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env. Aborting.');
    process.exit(1);
  }

  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log('No db.json found — nothing to migrate.');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
  const users = raw.users || {};
  const bills = raw.bills || {};

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      picture_url TEXT,
      bank_name TEXT,
      account_number TEXT,
      account_name TEXT,
      updated_at BIGINT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      status TEXT NOT NULL,
      data JSONB NOT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bills_group_status ON bills (group_id, status);`);

  let userCount = 0;
  for (const [userId, u] of Object.entries(users)) {
    await pool.query(
      `INSERT INTO users (id, display_name, picture_url, bank_name, account_number, account_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         picture_url = EXCLUDED.picture_url,
         bank_name = EXCLUDED.bank_name,
         account_number = EXCLUDED.account_number,
         account_name = EXCLUDED.account_name,
         updated_at = EXCLUDED.updated_at`,
      [userId, u.displayName || null, u.pictureUrl || null, u.bankName || null, u.accountNumber || null, u.accountName || null, u.updatedAt || null]
    );
    userCount++;
  }

  let billCount = 0;
  for (const [billId, b] of Object.entries(bills)) {
    await pool.query(
      `INSERT INTO bills (id, group_id, status, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         group_id = EXCLUDED.group_id,
         status = EXCLUDED.status,
         data = EXCLUDED.data`,
      [billId, b.groupId, b.status, JSON.stringify(b)]
    );
    billCount++;
  }

  await pool.end();
  console.log(`Migration complete: ${userCount} users, ${billCount} bills imported into Postgres.`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
