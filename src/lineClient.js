const { messagingApi } = require('@line/bot-sdk');
const crypto = require('crypto');
require('dotenv').config();

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'mock_channel_access_token';
const channelSecret = process.env.LINE_CHANNEL_SECRET || 'mock_channel_secret';

let client = null;
let blobClient = null;
let isMock = channelAccessToken === 'mock_channel_access_token' || channelAccessToken.startsWith('your_');

if (!isMock) {
  try {
    client = new messagingApi.MessagingApiClient({
      channelAccessToken: channelAccessToken
    });
    blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: channelAccessToken
    });
  } catch (error) {
    console.error('Failed to initialize LINE Messaging API Client:', error);
    isMock = true;
  }
}

/**
 * Verifies signature
 */
function verifySignature(signature, rawBody) {
  if (isMock) return true;
  if (!signature || !rawBody) return false;
  
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(rawBody)
    .digest('base64');
    
  return hash === signature;
}

/**
 * Get profile of a user (Safe & Fail-proof)
 */
async function getUserProfile(userId, groupId = null) {
  if (isMock || !userId) {
    return {
      userId: userId || 'mock_user',
      displayName: `เพื่อน_${(userId || 'user').substring(0, 5)}`,
      pictureUrl: 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
    };
  }

  try {
    if (groupId && groupId.startsWith('C')) {
      const p = await client.getGroupMemberProfile(groupId, userId);
      if (p && p.displayName) return p;
    }
  } catch (err) {
    // Ignore group member fetch errors
  }

  try {
    const p = await client.getProfile(userId);
    if (p && p.displayName) return p;
  } catch (err) {
    // Ignore profile fetch errors
  }

  return {
    userId: userId,
    displayName: `เพื่อน_${userId.substring(0, 5)}`,
    pictureUrl: 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
  };
}

/**
 * Get message content (Image binary stream)
 */
async function getMessageContent(messageId) {
  if (isMock || !blobClient) {
    return null;
  }

  try {
    const stream = await blobClient.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Error downloading message content for ${messageId}:`, error.message);
    return null;
  }
}

/**
 * Replies to a message
 */
async function replyMessage(replyToken, messages) {
  const formattedMessages = Array.isArray(messages) ? messages : [messages];
  
  if (isMock) {
    console.log(`[MOCK REPLY] Token: ${replyToken}`);
    console.log(JSON.stringify(formattedMessages, null, 2));
    return { mock: true };
  }

  try {
    return await client.replyMessage({
      replyToken: replyToken,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Error replying to LINE API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Pushes a message
 */
async function pushMessage(to, messages) {
  const formattedMessages = Array.isArray(messages) ? messages : [messages];
  
  if (isMock) {
    console.log(`[MOCK PUSH] To: ${to}`);
    console.log(JSON.stringify(formattedMessages, null, 2));
    return { mock: true };
  }

  try {
    return await client.pushMessage({
      to: to,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Error pushing to LINE API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  verifySignature,
  getUserProfile,
  getMessageContent,
  replyMessage,
  pushMessage,
  isMock
};
