/**
 * MongoDB adapter for @sesame/auth
 * Requires: npm install mongodb
 *
 * @module @sesame/auth/adapters/mongodb
 */

const { validateAgentData, sanitizeAgentForResponse } = require('./base');

const DEFAULT_COLLECTION = 'sesame_agents';

/**
 * Create MongoDB adapter
 *
 * @param {Object} options - Configuration (or use env vars)
 * @param {string} [options.connectionString] - MongoDB connection string
 * @param {string} [options.database] - Database name (default: sesame)
 * @param {string} [options.collection] - Collection name (default: sesame_agents)
 * @param {Object} [options.client] - Existing MongoClient instance
 * @returns {Object} Adapter with createAgent, findAgentByApiKeyHash, etc.
 *
 * Env vars (fallback when options not provided):
 *   MONGODB_URI, MONGODB_URL, or SESAME_MONGODB_URI
 *   SESAME_MONGODB_DATABASE (optional)
 *   SESAME_MONGODB_COLLECTION (optional)
 */
function mongodbAdapter(options = {}) {
  let mongo;
  try {
    mongo = require('mongodb');
  } catch (e) {
    throw new Error('Install mongodb to use MongoDB adapter: npm install mongodb');
  }

  const connectionString = options.connectionString ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.SESAME_MONGODB_URI;

  const dbName = options.database ||
    process.env.SESAME_MONGODB_DATABASE ||
    'sesame';
  const collectionName = options.collection ||
    process.env.SESAME_MONGODB_COLLECTION ||
    DEFAULT_COLLECTION;
  let client = options.client;
  let _collection;

  async function getCollection() {
    if (_collection) return _collection;
    if (!client) {
      if (!connectionString) {
        throw new Error('MongoDB connection string required. Set MONGODB_URI or pass connectionString in options.');
      }
      client = new mongo.MongoClient(connectionString);
      await client.connect();
    }
    _collection = client.db(dbName).collection(collectionName);
    return _collection;
  }

  return {
    async createAgent(data) {
      validateAgentData(data);
      const col = await getCollection();
      const doc = {
        api_key_hash: data.apiKeyHash,
        claim_token: data.claimToken,
        verification_code: data.verificationCode,
        name: data.name || null,
        description: data.description || null,
        status: 'pending_claim',
        created_at: new Date(),
        updated_at: new Date()
      };
      const result = await col.insertOne(doc);
      return { id: result.insertedId.toString() };
    },

    async findAgentByApiKeyHash(hash) {
      if (!hash || typeof hash !== 'string') return null;
      const col = await getCollection();
      const doc = await col.findOne({ api_key_hash: hash });
      return doc ? sanitizeAgentForResponse(doc) : null;
    },

    async findAgentByVerificationCode(code) {
      if (!code || typeof code !== 'string') return null;
      const col = await getCollection();
      const doc = await col.findOne({ verification_code: code });
      return doc ? sanitizeAgentForResponse(doc) : null;
    },

    async findAgentByClaimToken(token) {
      if (!token || typeof token !== 'string') return null;
      const col = await getCollection();
      const doc = await col.findOne({ claim_token: token });
      return doc ? sanitizeAgentForResponse(doc) : null;
    },

    async updateAgentStatus(id, status) {
      if (!id || !status) return;
      const col = await getCollection();
      const _id = mongo.ObjectId.isValid(id) ? new mongo.ObjectId(id) : id;
      await col.updateOne(
        { _id },
        { $set: { status, updated_at: new Date() } }
      );
    },

    /** Create indexes for performance */
    async createIndexes() {
      const col = await getCollection();
      await col.createIndex({ api_key_hash: 1 }, { unique: true });
      await col.createIndex({ verification_code: 1 });
      await col.createIndex({ claim_token: 1 }, { unique: true });
    }
  };
}

module.exports = mongodbAdapter;
