/**
 * Database adapters for @sesame/auth
 * Sesame - Agent auth for OpenClaw/Clawd bots
 *
 * Adapters handle storage with security best practices:
 * - API keys are hashed before storage (never store plain keys)
 * - Parameterized queries prevent injection
 * - Input validation on all writes
 *
 * @module @sesame/auth/adapters
 */

const postgresAdapter = require('./postgres');
const mongodbAdapter = require('./mongodb');
const firebaseAdapter = require('./firebase');
const supabaseAdapter = require('./supabase');

/**
 * Create adapter by type
 *
 * @param {string} type - 'postgres' | 'mongodb' | 'firebase' | 'supabase'
 * @param {Object} options - Adapter-specific config
 * @returns {Object} Adapter instance
 */
function createAdapter(type, options = {}) {
  const adapters = {
    postgres: postgresAdapter,
    mongodb: mongodbAdapter,
    firebase: firebaseAdapter,
    supabase: supabaseAdapter
  };
  const Adapter = adapters[type];
  if (!Adapter) {
    throw new Error(`Unknown adapter: ${type}. Use: postgres, mongodb, firebase, supabase`);
  }
  return Adapter(options);
}

/**
 * Create getUserByToken function from adapter
 * Hashes token and looks up agent - use with authMiddleware
 *
 * @param {Object} adapter - Adapter instance (createAgent, findAgentByApiKeyHash, etc.)
 * @param {Object} utils - Sesame utils (hashToken)
 * @returns {Function} getUserByToken(token) => agent | null
 */
function createGetUserByToken(adapter, utils) {
  return async (token) => {
    const hash = utils.hashToken(token);
    return adapter.findAgentByApiKeyHash(hash);
  };
}

module.exports = {
  postgresAdapter,
  mongodbAdapter,
  firebaseAdapter,
  supabaseAdapter,
  createAdapter,
  createGetUserByToken
};
