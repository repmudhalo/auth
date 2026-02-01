/**
 * @sesame/auth
 *
 * Sesame - Agent authentication for OpenClaw/Clawd bots
 * Add agent logins to your app with a few lines of code.
 *
 * @license MIT
 *
 * @example
 * const { SesameAuth, authMiddleware } = require('@sesame/auth');
 *
 * const auth = new SesameAuth();
 * app.use('/api/v1', authMiddleware(auth, { getUserByToken }));
 */

const SesameAuth = require('./SesameAuth');
const {
  authMiddleware,
  requireClaimed,
  optionalAuth,
  ErrorCodes,
  ErrorMessages,
  sanitizeAgent
} = require('./middleware/auth');
const utils = require('./utils');
const adapters = require('./adapters');

// Default instance for convenience
const defaultAuth = new SesameAuth();

module.exports = {
  // Main class
  SesameAuth,

  // Middleware
  authMiddleware,
  requireClaimed,
  optionalAuth,

  // Error handling
  ErrorCodes,
  ErrorMessages,

  // Utilities
  utils,
  sanitizeAgent,

  // Database adapters (Postgres, MongoDB, Firebase, Supabase)
  adapters,

  // Convenience methods from default instance
  generateApiKey: () => defaultAuth.generateApiKey(),
  generateClaimToken: () => defaultAuth.generateClaimToken(),
  generateVerificationCode: () => defaultAuth.generateVerificationCode(),
  validateApiKey: (token) => defaultAuth.validateApiKey(token),
  validateClaimToken: (token) => defaultAuth.validateClaimToken(token),
  validateToken: (token) => defaultAuth.validateToken(token),
  extractToken: (header) => defaultAuth.extractToken(header),
  compareTokens: (a, b) => defaultAuth.compareTokens(a, b),

  // Default instance
  default: defaultAuth
};
