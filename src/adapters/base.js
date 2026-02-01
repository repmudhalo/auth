/**
 * Base adapter interface and validation
 * Sesame - Agent auth for OpenClaw/Clawd bots
 *
 * All adapters must implement:
 * - createAgent(data) -> { id }
 * - findAgentByApiKeyHash(hash) -> agent | null
 * - findAgentByVerificationCode(code) -> agent | null
 * - findAgentByClaimToken(token) -> agent | null
 * - updateAgentStatus(id, status) -> void
 *
 * Security: Adapters never receive or store plain API keys.
 * Callers must pass apiKeyHash (from utils.hashToken).
 */

/**
 * Validate agent data before storage
 * Prevents injection and ensures required fields
 *
 * @param {Object} data - Agent data
 * @param {string} data.apiKeyHash - SHA-256 hash (64 hex chars)
 * @param {string} data.claimToken - Claim token
 * @param {string} data.verificationCode - Verification code
 * @param {string} [data.name] - Agent name
 * @param {string} [data.description] - Agent description
 */
function validateAgentData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Agent data must be an object');
  }
  if (!data.apiKeyHash || typeof data.apiKeyHash !== 'string') {
    throw new Error('apiKeyHash is required');
  }
  if (data.apiKeyHash.length !== 64 || !/^[a-f0-9]+$/i.test(data.apiKeyHash)) {
    throw new Error('apiKeyHash must be 64 hex characters (SHA-256)');
  }
  if (!data.claimToken || typeof data.claimToken !== 'string') {
    throw new Error('claimToken is required');
  }
  if (!data.verificationCode || typeof data.verificationCode !== 'string') {
    throw new Error('verificationCode is required');
  }
}

/**
 * Sanitize agent for response - remove internal fields
 *
 * @param {Object} agent - Raw agent from DB
 * @returns {Object} Sanitized agent
 */
function sanitizeAgentForResponse(agent) {
  if (!agent) return null;
  const { api_key_hash, apiKeyHash, ...safe } = agent;
  return safe;
}

/**
 * Validate table/collection name - prevent injection
 * Only alphanumeric and underscore allowed
 *
 * @param {string} name - Table or collection name
 * @returns {boolean} True if safe
 */
function validateTableName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_]+$/.test(name) && name.length <= 64;
}

module.exports = {
  validateAgentData,
  sanitizeAgentForResponse,
  validateTableName
};
