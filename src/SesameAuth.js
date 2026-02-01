/**
 * @sesame/auth
 * Sesame - Agent authentication for OpenClaw/Clawd bots
 *
 * @license MIT
 */

const crypto = require('crypto');

// Word lists for verification codes
const ADJECTIVES = [
  'reef', 'wave', 'coral', 'shell', 'tide', 'kelp', 'foam', 'salt',
  'deep', 'blue', 'aqua', 'pearl', 'sand', 'surf', 'cove', 'bay'
];

/**
 * SesameAuth - Main authentication class for OpenClaw/Clawd agent logins
 *
 * Designed for developers to easily add agent authentication to their apps.
 * Agents (OpenClaw/Clawd bots) receive API keys and use Bearer tokens to authenticate.
 */
class SesameAuth {
  /**
   * Create a new SesameAuth instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.tokenPrefix - Prefix for API keys (default: 'sesame_')
   * @param {string} options.claimPrefix - Prefix for claim tokens (default: 'sesame_claim_')
   * @param {number} options.tokenLength - Random bytes for token (default: 32)
   * @param {string} options.claimBaseUrl - Base URL for claim flow (e.g. 'https://myapp.com')
   */
  constructor(options = {}) {
    this.tokenPrefix = options.tokenPrefix || 'sesame_';
    this.claimPrefix = options.claimPrefix || 'sesame_claim_';
    this.tokenLength = options.tokenLength || 32;
    this.claimBaseUrl = options.claimBaseUrl || '';

    // Precompute expected lengths
    this._apiKeyLength = this.tokenPrefix.length + (this.tokenLength * 2);
    this._claimTokenLength = this.claimPrefix.length + (this.tokenLength * 2);
  }

  /**
   * Generate a secure random hex string
   *
   * @private
   * @param {number} bytes - Number of random bytes
   * @returns {string} Hex string
   */
  _randomHex(bytes) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate a new API key for an agent
   *
   * @returns {string} API key with sesame_ prefix
   * @example
   * const apiKey = auth.generateApiKey();
   * // 'sesame_a1b2c3d4e5f6789...'
   */
  generateApiKey() {
    return `${this.tokenPrefix}${this._randomHex(this.tokenLength)}`;
  }

  /**
   * Generate a claim token for human verification
   *
   * @returns {string} Claim token with sesame_claim_ prefix
   * @example
   * const claimToken = auth.generateClaimToken();
   * // 'sesame_claim_x9y8z7w6v5u4...'
   */
  generateClaimToken() {
    return `${this.claimPrefix}${this._randomHex(this.tokenLength)}`;
  }

  /**
   * Generate a human-readable verification code
   * Used for tweet/social verification
   *
   * @returns {string} Verification code like 'reef-X4B2'
   * @example
   * const code = auth.generateVerificationCode();
   * // 'reef-X4B2'
   */
  generateVerificationCode() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const suffix = this._randomHex(2).toUpperCase();
    return `${adjective}-${suffix}`;
  }

  /**
   * Validate API key format
   *
   * @param {string} token - Token to validate
   * @returns {boolean} True if valid format
   */
  validateApiKey(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    if (!token.startsWith(this.tokenPrefix)) {
      return false;
    }

    if (token.length !== this._apiKeyLength) {
      return false;
    }

    // Check hex format
    const body = token.slice(this.tokenPrefix.length);
    return /^[0-9a-f]+$/i.test(body);
  }

  /**
   * Validate claim token format
   *
   * @param {string} token - Token to validate
   * @returns {boolean} True if valid format
   */
  validateClaimToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    if (!token.startsWith(this.claimPrefix)) {
      return false;
    }

    if (token.length !== this._claimTokenLength) {
      return false;
    }

    const body = token.slice(this.claimPrefix.length);
    return /^[0-9a-f]+$/i.test(body);
  }

  /**
   * Validate any Sesame token (API key or claim token)
   *
   * @param {string} token - Token to validate
   * @returns {boolean} True if valid format
   */
  validateToken(token) {
    return this.validateApiKey(token) || this.validateClaimToken(token);
  }

  /**
   * Extract token from Authorization header
   *
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token or null
   * @example
   * auth.extractToken('Bearer sesame_abc123...');
   * // 'sesame_abc123...'
   */
  extractToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;

    if (scheme.toLowerCase() !== 'bearer') {
      return null;
    }

    return token;
  }

  /**
   * Timing-safe token comparison
   * Prevents timing attacks
   *
   * @param {string} tokenA - First token
   * @param {string} tokenB - Second token
   * @returns {boolean} True if tokens match
   */
  compareTokens(tokenA, tokenB) {
    if (!tokenA || !tokenB) {
      return false;
    }

    if (tokenA.length !== tokenB.length) {
      // Still do comparison to maintain constant time
      crypto.timingSafeEqual(
        Buffer.from(tokenA),
        Buffer.from(tokenA)
      );
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(tokenA),
      Buffer.from(tokenB)
    );
  }

  /**
   * Create registration response object
   * Convenience method for agent registration endpoints
   *
   * @param {string} name - Agent name
   * @param {string} description - Agent description
   * @returns {Object} Registration response
   */
  createRegistration(name, description = '') {
    const apiKey = this.generateApiKey();
    const claimToken = this.generateClaimToken();
    const verificationCode = this.generateVerificationCode();

    // Build claim URL - use claimBaseUrl if configured
    const claimPath = `/claim/${claimToken}`;
    const claimUrl = this.claimBaseUrl
      ? `${this.claimBaseUrl.replace(/\/$/, '')}${claimPath}`
      : claimPath;

    return {
      apiKey,
      claimToken,
      verificationCode,
      response: {
        agent: {
          api_key: apiKey,
          claim_url: claimUrl,
          verification_code: verificationCode
        },
        important: '⚠️ SAVE YOUR API KEY!'
      }
    };
  }
}

module.exports = SesameAuth;
