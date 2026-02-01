/**
 * Supabase adapter for @sesame/auth
 * Requires: npm install @supabase/supabase-js
 *
 * @module @sesame/auth/adapters/supabase
 */

const { validateAgentData, sanitizeAgentForResponse, validateTableName } = require('./base');

const DEFAULT_TABLE = 'sesame_agents';

/**
 * Create Supabase adapter
 *
 * @param {Object} options - Configuration (or use env vars)
 * @param {string} [options.url] - Supabase project URL
 * @param {string} [options.serviceKey] - Supabase service role key (for server-side)
 * @param {string} [options.table] - Table name (default: sesame_agents)
 * @param {Object} [options.client] - Existing Supabase client instance
 * @returns {Object} Adapter with createAgent, findAgentByApiKeyHash, etc.
 *
 * Env vars (fallback when options not provided):
 *   SUPABASE_URL or SESAME_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SESAME_SUPABASE_SERVICE_KEY
 *   SESAME_SUPABASE_TABLE (optional)
 */
function supabaseAdapter(options = {}) {
  let supabase;
  try {
    supabase = require('@supabase/supabase-js');
  } catch (e) {
    throw new Error('Install @supabase/supabase-js to use Supabase adapter: npm install @supabase/supabase-js');
  }

  const url = options.url ||
    process.env.SUPABASE_URL ||
    process.env.SESAME_SUPABASE_URL;
  const serviceKey = options.serviceKey ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SESAME_SUPABASE_SERVICE_KEY;

  const table = options.table ||
    process.env.SESAME_SUPABASE_TABLE ||
    DEFAULT_TABLE;
  if (!validateTableName(table)) {
    throw new Error('Invalid table name: use only alphanumeric and underscore');
  }

  if (!options.client && (!url || !serviceKey)) {
    throw new Error('Supabase URL and service key required. Set SUPABASE_URL and SUPABASE_SERVICE_KEY, or pass url/serviceKey in options.');
  }

  const client = options.client || supabase.createClient(url, serviceKey);

  return {
    async createAgent(data) {
      validateAgentData(data);
      const { data: row, error } = await client
        .from(table)
        .insert({
          api_key_hash: data.apiKeyHash,
          claim_token: data.claimToken,
          verification_code: data.verificationCode,
          name: data.name || null,
          description: data.description || null,
          status: 'pending_claim'
        })
        .select('id')
        .single();

      if (error) throw new Error(`Supabase: ${error.message}`);
      return { id: row.id };
    },

    async findAgentByApiKeyHash(hash) {
      if (!hash || typeof hash !== 'string') return null;
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('api_key_hash', hash)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw new Error(`Supabase: ${error.message}`);
      return data ? sanitizeAgentForResponse(data) : null;
    },

    async findAgentByVerificationCode(code) {
      if (!code || typeof code !== 'string') return null;
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('verification_code', code)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw new Error(`Supabase: ${error.message}`);
      return data ? sanitizeAgentForResponse(data) : null;
    },

    async findAgentByClaimToken(token) {
      if (!token || typeof token !== 'string') return null;
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('claim_token', token)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw new Error(`Supabase: ${error.message}`);
      return data ? sanitizeAgentForResponse(data) : null;
    },

    async updateAgentStatus(id, status) {
      if (!id || !status) return;
      const { error } = await client
        .from(table)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(`Supabase: ${error.message}`);
    },

    /** Get SQL for table creation (run in Supabase SQL editor) */
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_${table}_api_key_hash ON ${table}(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_${table}_verification_code ON ${table}(verification_code);
CREATE INDEX IF NOT EXISTS idx_${table}_claim_token ON ${table}(claim_token);
`.trim();
    }
  };
}

module.exports = supabaseAdapter;
