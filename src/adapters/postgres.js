/**
 * Postgres adapter for @sesame/auth
 * Requires: npm install pg
 *
 * @module @sesame/auth/adapters/postgres
 */

const { validateAgentData, sanitizeAgentForResponse, validateTableName } = require('./base');

const DEFAULT_TABLE = 'sesame_agents';

/**
 * Create Postgres adapter
 *
 * @param {Object} options - Configuration (or use env vars)
 * @param {string} [options.connectionString] - Postgres connection string
 * @param {Object} [options.pool] - pg.Pool options (host, port, user, password, database)
 * @param {string} [options.table] - Table name (default: sesame_agents)
 * @returns {Object} Adapter with createAgent, findAgentByApiKeyHash, etc.
 *
 * Env vars (fallback when options not provided):
 *   DATABASE_URL, POSTGRES_URL, or SESAME_DATABASE_URL
 *   SESAME_POSTGRES_TABLE (optional)
 */
function postgresAdapter(options = {}) {
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    throw new Error('Install pg to use Postgres adapter: npm install pg');
  }

  const connectionString = options.connectionString ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SESAME_DATABASE_URL;

  const table = options.table ||
    process.env.SESAME_POSTGRES_TABLE ||
    DEFAULT_TABLE;

  if (!validateTableName(table)) {
    throw new Error('Invalid table name: use only alphanumeric and underscore');
  }

  if (!options.pool && !connectionString) {
    throw new Error('Postgres connection required. Set DATABASE_URL or pass connectionString in options.');
  }

  const pool = options.pool
    ? new pg.Pool(options.pool)
    : new pg.Pool({ connectionString });

  return {
    /**
     * Create agent (uses parameterized query - SQL injection safe)
     */
    async createAgent(data) {
      validateAgentData(data);
      const result = await pool.query(
        `INSERT INTO ${table} (api_key_hash, claim_token, verification_code, name, description, status)
         VALUES ($1, $2, $3, $4, $5, 'pending_claim')
         RETURNING id`,
        [
          data.apiKeyHash,
          data.claimToken,
          data.verificationCode,
          data.name || null,
          data.description || null
        ]
      );
      return { id: result.rows[0].id };
    },

    async findAgentByApiKeyHash(hash) {
      if (!hash || typeof hash !== 'string') return null;
      const result = await pool.query(
        `SELECT * FROM ${table} WHERE api_key_hash = $1 LIMIT 1`,
        [hash]
      );
      return result.rows[0] ? sanitizeAgentForResponse(result.rows[0]) : null;
    },

    async findAgentByVerificationCode(code) {
      if (!code || typeof code !== 'string') return null;
      const result = await pool.query(
        `SELECT * FROM ${table} WHERE verification_code = $1 LIMIT 1`,
        [code]
      );
      return result.rows[0] ? sanitizeAgentForResponse(result.rows[0]) : null;
    },

    async findAgentByClaimToken(token) {
      if (!token || typeof token !== 'string') return null;
      const result = await pool.query(
        `SELECT * FROM ${table} WHERE claim_token = $1 LIMIT 1`,
        [token]
      );
      return result.rows[0] ? sanitizeAgentForResponse(result.rows[0]) : null;
    },

    async updateAgentStatus(id, status) {
      if (!id || !status) return;
      await pool.query(
        `UPDATE ${table} SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id]
      );
    },

    /** Get SQL for table creation */
    getCreateTableSQL() {
      return `
CREATE TABLE IF NOT EXISTS ${table} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash VARCHAR(64) UNIQUE NOT NULL,
  claim_token VARCHAR(255) NOT NULL UNIQUE,
  verification_code VARCHAR(32) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(32) DEFAULT 'pending_claim',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_${table}_api_key_hash ON ${table}(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_${table}_verification_code ON ${table}(verification_code);
CREATE INDEX IF NOT EXISTS idx_${table}_claim_token ON ${table}(claim_token);
`.trim();
    }
  };
}

module.exports = postgresAdapter;
