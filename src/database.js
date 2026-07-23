const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );
  `);
}

const ready = initDb().catch(err => {
  console.error('Failed to initialize Postgres schema:', err);
  throw err;
});

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountName: row.account_name,
    updatedAt: row.updated_at !== null ? Number(row.updated_at) : null
  };
}

const database = {
  // --- User Operations ---
  async getUser(userId) {
    if (!userId) return null;
    await ready;
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return rowToUser(res.rows[0]);
  },

  async saveUser(userId, userData) {
    if (!userId) return null;
    await ready;
    const existing = await database.getUser(userId);
    const merged = {
      ...existing,
      ...userData,
      id: userId,
      updatedAt: Date.now()
    };

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
      [userId, merged.displayName, merged.pictureUrl, merged.bankName, merged.accountNumber, merged.accountName, merged.updatedAt]
    );

    return merged;
  },

  async getAllUsers() {
    await ready;
    const res = await pool.query('SELECT * FROM users');
    return res.rows.map(rowToUser);
  },

  // --- Group Membership (keeps per-group data, like "ดูบัญชี", scoped correctly
  // when the bot is used across multiple LINE groups) ---
  async addGroupMember(groupId, userId) {
    if (!groupId || !userId) return;
    await ready;
    await pool.query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [groupId, userId]
    );
  },

  async getUsersInGroup(groupId) {
    if (!groupId) return [];
    await ready;
    const res = await pool.query(
      `SELECT u.* FROM users u
       INNER JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [groupId]
    );
    return res.rows.map(rowToUser);
  },

  // --- Bill Operations ---
  async getBill(billId) {
    if (!billId) return null;
    await ready;
    const res = await pool.query('SELECT data FROM bills WHERE id = $1', [billId]);
    return res.rows[0] ? res.rows[0].data : null;
  },

  async getActiveBill(groupId) {
    if (!groupId) return null;
    await ready;
    const res = await pool.query(
      `SELECT data FROM bills WHERE group_id = $1 AND status != 'closed'
       ORDER BY (data->>'createdAt')::bigint DESC LIMIT 1`,
      [groupId]
    );
    return res.rows[0] ? res.rows[0].data : null;
  },

  async createBill(groupId, creatorId, title, type = 'equal') {
    await ready;

    // Close any existing active bill in the same group first
    await pool.query(
      `UPDATE bills
       SET status = 'closed',
           data = jsonb_set(jsonb_set(data, '{status}', '"closed"'), '{closedAt}', to_jsonb($2::bigint))
       WHERE group_id = $1 AND status != 'closed'`,
      [groupId, Date.now()]
    );

    const billId = 'bill_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    const newBill = {
      id: billId,
      groupId: groupId,
      title: title || 'ค่าอาหาร',
      type: type, // 'equal' or 'multi'
      status: 'collecting', // 'collecting', 'settling', 'closed'
      creatorId: creatorId,
      payers: [], // Array of { userId, displayName, amountPaid }
      participants: [], // Array of { userId, displayName, share, hasPaid }
      transfers: [], // Array of { fromUserId, fromName, toUserId, toName, amount }
      createdAt: Date.now()
    };

    await pool.query(
      'INSERT INTO bills (id, group_id, status, data) VALUES ($1, $2, $3, $4)',
      [billId, groupId, 'collecting', JSON.stringify(newBill)]
    );

    return newBill;
  },

  async updateBill(billId, updateFn) {
    await ready;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('SELECT data FROM bills WHERE id = $1 FOR UPDATE', [billId]);
      if (!res.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      const billCopy = res.rows[0].data;
      let updatedBill;
      try {
        updatedBill = updateFn(billCopy);
      } catch (e) {
        console.error(`Error updating bill ${billId}:`, e);
        await client.query('ROLLBACK');
        return billCopy;
      }

      if (updatedBill) {
        await client.query(
          'UPDATE bills SET status = $2, data = $3 WHERE id = $1',
          [billId, updatedBill.status, JSON.stringify(updatedBill)]
        );
        await client.query('COMMIT');
        return updatedBill;
      }

      await client.query('ROLLBACK');
      return billCopy;
    } finally {
      client.release();
    }
  },

  async deleteBill(billId) {
    if (!billId) return null;
    await ready;
    await pool.query('DELETE FROM bills WHERE id = $1', [billId]);
    return true;
  }
};

module.exports = database;
