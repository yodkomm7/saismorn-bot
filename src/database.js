const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

// Initialize database file if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: {},
      bills: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// Read database
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, resetting database:', error);
    const initialData = { users: {}, bills: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
}

// Write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database:', error);
    throw error;
  }
}

const database = {
  // --- User Operations ---
  getUser(userId) {
    if (!userId) return null;
    const db = readDb();
    return db.users[userId] || null;
  },

  saveUser(userId, userData) {
    if (!userId) return null;
    const db = readDb();
    const existing = db.users[userId] || { id: userId };
    db.users[userId] = {
      ...existing,
      ...userData,
      updatedAt: Date.now()
    };
    writeDb(db);
    return db.users[userId];
  },

  getAllUsers() {
    const db = readDb();
    return Object.values(db.users);
  },

  // --- Bill Operations ---
  getBill(billId) {
    if (!billId) return null;
    const db = readDb();
    return db.bills[billId] || null;
  },

  getActiveBill(groupId) {
    if (!groupId) return null;
    const db = readDb();
    return Object.values(db.bills).find(
      bill => bill.groupId === groupId && bill.status !== 'closed'
    ) || null;
  },

  createBill(groupId, creatorId, title, type = 'equal') {
    const db = readDb();
    
    // Close any existing active bill in the same group first
    Object.values(db.bills).forEach(bill => {
      if (bill.groupId === groupId && bill.status !== 'closed') {
        bill.status = 'closed';
        bill.closedAt = Date.now();
      }
    });

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

    db.bills[billId] = newBill;
    writeDb(db);
    return newBill;
  },

  updateBill(billId, updateFn) {
    const db = readDb();
    if (!db.bills[billId]) {
      return null;
    }
    
    // Pass a copy of the bill to the update function to prevent mutations if it fails
    const billCopy = JSON.parse(JSON.stringify(db.bills[billId]));
    try {
      const updatedBill = updateFn(billCopy);
      if (updatedBill) {
        db.bills[billId] = updatedBill;
        writeDb(db);
        return updatedBill;
      }
    } catch (e) {
      console.error(`Error updating bill ${billId}:`, e);
    }
    return db.bills[billId];
  }
};

module.exports = database;
