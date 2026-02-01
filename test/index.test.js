/**
 * @sesame/auth Test Suite
 *
 * Run: npm test
 */

const {
  SesameAuth,
  authMiddleware,
  optionalAuth,
  ErrorCodes,
  utils,
  generateApiKey,
  validateApiKey,
  extractToken
} = require('../src');

// ============================================
// Test Framework
// ============================================

let passed = 0;
let failed = 0;
let currentGroup = '';

function describe(name, fn) {
  currentGroup = name;
  console.log(`\n📦 ${name}\n`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ ${name}`);
    console.log(`      Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================
// Tests
// ============================================

console.log('\n🔑 @sesame/auth Test Suite\n');
console.log('═'.repeat(50));

// SesameAuth Class Tests
describe('SesameAuth', () => {
  test('creates instance with default options', () => {
    const auth = new SesameAuth();
    assertEqual(auth.tokenPrefix, 'sesame_');
    assertEqual(auth.claimPrefix, 'sesame_claim_');
    assertEqual(auth.tokenLength, 32);
  });

  test('creates instance with custom options', () => {
    const auth = new SesameAuth({
      tokenPrefix: 'custom_',
      claimPrefix: 'custom_claim_',
      tokenLength: 16
    });
    assertEqual(auth.tokenPrefix, 'custom_');
    assertEqual(auth.claimPrefix, 'custom_claim_');
    assertEqual(auth.tokenLength, 16);
  });

  test('accepts claimBaseUrl option', () => {
    const auth = new SesameAuth({ claimBaseUrl: 'https://myapp.com' });
    assertEqual(auth.claimBaseUrl, 'https://myapp.com');
  });
});

// API Key Generation Tests
describe('API Key Generation', () => {
  const auth = new SesameAuth();

  test('generates API key with correct prefix', () => {
    const apiKey = auth.generateApiKey();
    assert(apiKey.startsWith('sesame_'), 'Should start with sesame_');
  });

  test('generates API key with correct length', () => {
    const apiKey = auth.generateApiKey();
    // 'sesame_' (7) + 64 hex chars = 71
    assertEqual(apiKey.length, 71);
  });

  test('generates unique API keys', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(auth.generateApiKey());
    }
    assertEqual(keys.size, 100, 'All keys should be unique');
  });
});

// Claim Token Tests
describe('Claim Token Generation', () => {
  const auth = new SesameAuth();

  test('generates claim token with correct prefix', () => {
    const token = auth.generateClaimToken();
    assert(token.startsWith('sesame_claim_'), 'Should start with sesame_claim_');
  });

  test('generates claim token with correct length', () => {
    const token = auth.generateClaimToken();
    // 'sesame_claim_' (13) + 64 hex chars = 77
    assertEqual(token.length, 77);
  });
});

// Verification Code Tests
describe('Verification Code Generation', () => {
  const auth = new SesameAuth();

  test('generates verification code in correct format', () => {
    const code = auth.generateVerificationCode();
    assert(/^[a-z]+-[A-F0-9]{4}$/.test(code), `Invalid format: ${code}`);
  });

  test('generates unique verification codes', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(auth.generateVerificationCode());
    }
    assert(codes.size >= 45, 'Most codes should be unique');
  });
});

// Validation Tests
describe('Token Validation', () => {
  const auth = new SesameAuth();

  test('validates correct API key', () => {
    const apiKey = auth.generateApiKey();
    assert(auth.validateApiKey(apiKey), 'Should validate generated key');
  });

  test('rejects API key with wrong prefix', () => {
    assert(!auth.validateApiKey('wrong_abc123'), 'Should reject wrong prefix');
  });

  test('rejects short API key', () => {
    assert(!auth.validateApiKey('sesame_abc'), 'Should reject short key');
  });

  test('rejects null', () => {
    assert(!auth.validateApiKey(null), 'Should reject null');
  });

  test('rejects undefined', () => {
    assert(!auth.validateApiKey(undefined), 'Should reject undefined');
  });

  test('validates claim token', () => {
    const token = auth.generateClaimToken();
    assert(auth.validateClaimToken(token), 'Should validate claim token');
  });

  test('validateToken accepts both types', () => {
    const apiKey = auth.generateApiKey();
    const claimToken = auth.generateClaimToken();
    assert(auth.validateToken(apiKey), 'Should accept API key');
    assert(auth.validateToken(claimToken), 'Should accept claim token');
  });
});

// Token Extraction Tests
describe('Token Extraction', () => {
  const auth = new SesameAuth();

  test('extracts token from Bearer header', () => {
    const token = auth.extractToken('Bearer sesame_abc123');
    assertEqual(token, 'sesame_abc123');
  });

  test('handles lowercase bearer', () => {
    const token = auth.extractToken('bearer sesame_abc123');
    assertEqual(token, 'sesame_abc123');
  });

  test('rejects Basic auth', () => {
    const token = auth.extractToken('Basic abc123');
    assertEqual(token, null);
  });

  test('rejects missing header', () => {
    const token = auth.extractToken(undefined);
    assertEqual(token, null);
  });

  test('rejects malformed header', () => {
    assertEqual(auth.extractToken('Bearer'), null);
    assertEqual(auth.extractToken('Bearer token extra'), null);
    assertEqual(auth.extractToken(''), null);
  });
});

// Token Comparison Tests
describe('Token Comparison', () => {
  const auth = new SesameAuth();

  test('returns true for equal tokens', () => {
    const token = auth.generateApiKey();
    assert(auth.compareTokens(token, token), 'Same token should match');
  });

  test('returns false for different tokens', () => {
    const token1 = auth.generateApiKey();
    const token2 = auth.generateApiKey();
    assert(!auth.compareTokens(token1, token2), 'Different tokens should not match');
  });

  test('returns false for different lengths', () => {
    assert(!auth.compareTokens('short', 'longer_string'), 'Different lengths should not match');
  });

  test('handles null/undefined', () => {
    assert(!auth.compareTokens(null, 'token'), 'Should handle null');
    assert(!auth.compareTokens('token', undefined), 'Should handle undefined');
  });
});

// Registration Helper Tests
describe('Registration Helper', () => {
  test('creates complete registration object', () => {
    const auth = new SesameAuth();
    const reg = auth.createRegistration('TestAgent', 'A test agent');

    assert(reg.apiKey, 'Should have apiKey');
    assert(reg.claimToken, 'Should have claimToken');
    assert(reg.verificationCode, 'Should have verificationCode');
    assert(reg.response.agent.api_key, 'Response should have api_key');
    assert(reg.response.agent.claim_url.includes('/claim/'), 'Should have claim_url');
    assert(reg.response.important.includes('SAVE'), 'Should have warning');
  });

  test('claimBaseUrl builds full claim URL', () => {
    const auth = new SesameAuth({ claimBaseUrl: 'https://myapp.com' });
    const reg = auth.createRegistration('TestAgent');

    assert(reg.response.agent.claim_url.startsWith('https://myapp.com/claim/'), 'Should use claimBaseUrl');
    assert(reg.response.agent.claim_url.includes('sesame_claim_'), 'Should include claim token');
  });
});

// Convenience Export Tests
describe('Convenience Exports', () => {
  test('generateApiKey works', () => {
    const key = generateApiKey();
    assert(key.startsWith('sesame_'), 'Should generate valid key');
  });

  test('validateApiKey works', () => {
    const key = generateApiKey();
    assert(validateApiKey(key), 'Should validate key');
  });

  test('extractToken works', () => {
    const token = extractToken('Bearer sesame_test');
    assertEqual(token, 'sesame_test');
  });
});

// Utils Tests
describe('Utils', () => {
  test('hashToken creates consistent hash', () => {
    const hash1 = utils.hashToken('test_token');
    const hash2 = utils.hashToken('test_token');
    assertEqual(hash1, hash2, 'Same input should produce same hash');
  });

  test('validateTokenHash works', () => {
    const token = 'my_secret_token';
    const hash = utils.hashToken(token);
    assert(utils.validateTokenHash(token, hash), 'Should validate correct token');
    assert(!utils.validateTokenHash('wrong_token', hash), 'Should reject wrong token');
  });

  test('maskToken hides middle', () => {
    const masked = utils.maskToken('sesame_abcdefghijklmnop');
    assert(masked.includes('...'), 'Should have ellipsis');
    assert(!masked.includes('abcdefghijklmnop'), 'Should not show full token');
  });

  test('looksLikeToken identifies tokens', () => {
    assert(utils.looksLikeToken('sesame_abc'), 'Should identify API key');
    assert(utils.looksLikeToken('sesame_claim_abc'), 'Should identify claim token');
    assert(!utils.looksLikeToken('random_string'), 'Should reject random string');
  });

  test('parseClaimUrl extracts sesame token', () => {
    const token = utils.parseClaimUrl('https://myapp.com/claim/sesame_claim_abc123');
    assertEqual(token, 'sesame_claim_abc123');
  });

  test('parseClaimUrl supports legacy moltbook_claim_ (backward compat)', () => {
    const token = utils.parseClaimUrl('https://example.com/claim/moltbook_claim_abc123');
    assertEqual(token, 'moltbook_claim_abc123');
  });

  test('shortId generates ID', () => {
    const id = utils.shortId(8);
    assertEqual(id.length, 8);
  });
});

// Adapters Tests
describe('Adapters', () => {
  const { adapters } = require('../src');

  test('createAdapter throws for unknown type', () => {
    try {
      adapters.createAdapter('unknown');
      assert(false, 'Should throw');
    } catch (e) {
      assert(e.message.includes('Unknown adapter'));
    }
  });

  test('createGetUserByToken returns function', () => {
    const mockAdapter = {
      findAgentByApiKeyHash: async () => null
    };
    const getUserByToken = adapters.createGetUserByToken(mockAdapter, require('../src').utils);
    assertEqual(typeof getUserByToken, 'function');
  });
});

// Middleware Tests (Mock)
describe('Middleware', () => {
  test('authMiddleware is a function', () => {
    const auth = new SesameAuth();
    const middleware = authMiddleware(auth);
    assertEqual(typeof middleware, 'function');
  });

  test('optionalAuth is a function', () => {
    const auth = new SesameAuth();
    const middleware = optionalAuth(auth);
    assertEqual(typeof middleware, 'function');
  });

  test('ErrorCodes are defined', () => {
    assert(ErrorCodes.NO_TOKEN, 'Should have NO_TOKEN');
    assert(ErrorCodes.INVALID_FORMAT, 'Should have INVALID_FORMAT');
    assert(ErrorCodes.INVALID_TOKEN, 'Should have INVALID_TOKEN');
    assert(ErrorCodes.NOT_CLAIMED, 'Should have NOT_CLAIMED');
  });
});

// ============================================
// Results
// ============================================

console.log('\n' + '═'.repeat(50));
console.log(`\n🔑 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
