const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

// Free Permanent Cloud KV JSON Store endpoint
const CLOUD_API_URL = 'https://api.jsonbin.io/v3/b';
// Master Master Cloud Bin ID for Nong Som
let cloudBinId = process.env.CLOUD_BIN_ID || '';
const CLOUD_MASTER_KEY = '$2a$10$w8.2Z8vK7X5xR4zW9z6.1O7v9eK0X9vX5vX5vX5vX5vX5vX5vX5vX';

/**
 * Perform HTTPS Request
 */
function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('Cloud DB HTTPS Error:', err.message);
      resolve(null);
    });

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Fetch latest database from Cloud
 */
async function fetchFromCloud() {
  if (!cloudBinId) return null;
  
  try {
    const url = new URL(`https://api.jsonbin.io/v3/b/${cloudBinId}/latest`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'X-Bin-Meta': 'false'
      }
    };

    const res = await httpRequest(options);
    if (res && (res.users || res.bills)) {
      return res;
    }
  } catch (err) {
    console.warn('Failed to fetch DB from cloud:', err.message);
  }
  return null;
}

/**
 * Save database to Cloud asynchronously
 */
async function saveToCloud(dbData) {
  try {
    if (!cloudBinId) {
      // Create new bin if not exists
      const url = new URL('https://api.jsonbin.io/v3/b');
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bin-Private': 'false',
          'X-Bin-Name': 'nong_som_db'
        }
      };

      const res = await httpRequest(options, dbData);
      if (res && res.metadata && res.metadata.id) {
        cloudBinId = res.metadata.id;
        console.log(`Cloud DB initialized with Bin ID: ${cloudBinId}`);
      }
      return;
    }

    // Update existing bin
    const url = new URL(`https://api.jsonbin.io/v3/b/${cloudBinId}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    await httpRequest(options, dbData);
  } catch (err) {
    console.warn('Failed to save DB to cloud:', err.message);
  }
}

module.exports = {
  fetchFromCloud,
  saveToCloud
};
