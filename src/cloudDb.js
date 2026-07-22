const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

// ExtendsClass JSON Storage API Bin ID for Nong Som Bot
const CLOUD_BIN_ID = 'faedacc';
const CLOUD_API_URL = `https://extendsclass.com/api/json-storage/bin/${CLOUD_BIN_ID}`;

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
  try {
    const url = new URL(CLOUD_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET'
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
    const url = new URL(CLOUD_API_URL);
    const postData = JSON.stringify(dbData);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    await httpRequest(options, postData);
  } catch (err) {
    console.warn('Failed to save DB to cloud:', err.message);
  }
}

module.exports = {
  fetchFromCloud,
  saveToCloud
};
