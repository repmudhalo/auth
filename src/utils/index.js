/**
 * Utility functions for @sesame/auth
 * Sesame - Agent auth for OpenClaw/Clawd bots
 *
 * @module @sesame/auth/utils
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically secure random string
 *
 * @param {number} length - Length of string
 * @param {string} charset - Character set to use
 * @returns {string} Random string
 */
function randomString(length, charset = 'hex') {
  if (charset === 'hex') {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  if (charset === 'base64url') {
    return crypto.randomBytes(Math.ceil(length * 0.75))
      .toString('base64url')
      .slice(0, length);
  }

  // Custom charset
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Hash a token for storage
 * Never store plain tokens in database!
 *
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate token against hash
 *
 * @param {string} token - Plain token
 * @param {string} hash - Stored hash
 * @returns {boolean} True if match
 */
function validateTokenHash(token, hash) {
  const tokenHash = hashToken(token);

  // Timing-safe comparison
  if (tokenHash.length !== hash.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}

/**
 * Mask a token for logging/display
 * Shows first and last 4 characters
 *
 * @param {string} token - Token to mask
 * @returns {string} Masked token
 * @example
 * maskToken('sesame_abc123xyz789');
 * // 'sesame_abc1...x789'
 */
function maskToken(token) {
  if (!token || token.length < 16) {
    return '***';
  }

  const prefix = token.slice(0, 12);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Check if a string looks like a Sesame token
 * Quick check without full validation
 *
 * @param {string} str - String to check
 * @returns {boolean} True if might be a token
 */
function looksLikeToken(str) {
  return typeof str === 'string' &&
    (str.startsWith('sesame_') || str.startsWith('sesame_claim_'));
}

/**
 * Parse claim URL to extract token
 * Supports sesame_claim_ and legacy moltbook_claim_ (backward compat)
 *
 * @param {string} url - Claim URL
 * @returns {string|null} Claim token or null
 * @example
 * parseClaimUrl('https://myapp.com/claim/sesame_claim_abc123');
 * // 'sesame_claim_abc123'
 */
function parseClaimUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // sesame_claim_ and moltbook_claim_ (backward compat for existing integrations)
  const match = url.match(/\/claim\/((?:sesame_claim_|moltbook_claim_)[a-f0-9]+)$/i);
  return match ? match[1] : null;
}

/**
 * Generate a short ID for internal use
 * Not for security purposes
 *
 * @param {number} length - Length of ID
 * @returns {string} Short ID
 */
function shortId(length = 8) {
  return randomString(length, 'base64url');
}

module.exports = {
  randomString,
  hashToken,
  validateTokenHash,
  maskToken,
  looksLikeToken,
  parseClaimUrl,
  shortId
};
