# @sesame/auth 🔑

**Sesame** — Agent authentication for OpenClaw/Clawd bots. Add agent logins to your app with a few lines of code.

## Overview

Sesame lets developers add **agent authentication** to their APIs. When OpenClaw or Clawd agents call your app, they send a Bearer token. Sesame validates the token and attaches the agent to the request.

**You provide:** Your database. Sesame generates keys and validates tokens; you store agents and connect `getUserByToken` to your DB.

**Use cases:**
- APIs that OpenClaw/Clawd agents call as tools
- Apps where agents need to authenticate (e.g. social platforms, dashboards)
- Any service that needs to verify incoming requests from AI agents

## Installation

```bash
npm install @sesame/auth
```

**Requirements:** Node.js 18+, Express 4.18+ (or 5.x)

## Quick Start

```javascript
const express = require('express');
const { SesameAuth, authMiddleware } = require('@sesame/auth');

const app = express();
app.use(express.json());

const auth = new SesameAuth({ claimBaseUrl: 'https://myapp.com' });

// Your agent store (use a database in production)
const agents = new Map();

// Connect (public) — bot visits this when user says "Connect to YourSite"
app.post('/auth/connect', (req, res) => {
  const reg = auth.createRegistration(req.body.name, req.body.description);
  agents.set(reg.apiKey, {
    apiKey: reg.apiKey,
    name: req.body.name,
    status: 'pending_claim',
    claimToken: reg.claimToken,
    verificationCode: reg.verificationCode
  });
  // Bot tells user: "Post {verification_code} to X/Discord to verify"
  res.json(reg.response);
});

// Protect API routes
app.use('/api/v1', authMiddleware(auth, {
  getUserByToken: (token) => agents.get(token) || null
}));

// Protected route
app.get('/api/v1/agents/me', (req, res) => {
  res.json({ agent: req.agent });
});
```

## Database Adapters

Sesame includes adapters for **Postgres**, **MongoDB**, **Firebase**, and **Supabase**. Install the driver for your database.

### Environment Variables

Add credentials to `.env` (copy from `.env.example`). Adapters read from env when options aren't passed:

| Adapter | Env vars |
|---------|----------|
| **Postgres** | `DATABASE_URL`, `POSTGRES_URL`, or `SESAME_DATABASE_URL` |
| **MongoDB** | `MONGODB_URI`, `MONGODB_URL`, or `SESAME_MONGODB_URI` |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) |
| **Firebase** | `GOOGLE_APPLICATION_CREDENTIALS`, `GCLOUD_PROJECT` or `FIREBASE_PROJECT_ID` |

Optional: `SESAME_*_TABLE`, `SESAME_*_COLLECTION`, `SESAME_*_DATABASE` to override defaults.

```bash
# Postgres
npm install pg

# MongoDB
npm install mongodb

# Firebase
npm install firebase-admin

# Supabase
npm install @supabase/supabase-js
```

### Postgres

```javascript
const { SesameAuth, authMiddleware, adapters, utils } = require('@sesame/auth');

const auth = new SesameAuth({ claimBaseUrl: 'https://myapp.com' });
const db = adapters.postgresAdapter({
  connectionString: process.env.DATABASE_URL,
  table: 'sesame_agents'  // optional, default: sesame_agents
});

// Create table (run once)
// console.log(db.getCreateTableSQL());

app.post('/auth/connect', async (req, res) => {
  const reg = auth.createRegistration(req.body.name, req.body.description);
  await db.createAgent({
    apiKeyHash: utils.hashToken(reg.apiKey),
    claimToken: reg.claimToken,
    verificationCode: reg.verificationCode,
    name: req.body.name,
    description: req.body.description
  });
  res.json(reg.response);
});

app.use('/api/v1', authMiddleware(auth, {
  getUserByToken: adapters.createGetUserByToken(db, utils)
}));
```

### MongoDB

```javascript
// Reads MONGODB_URI from env if no options passed
const db = adapters.mongodbAdapter();

// Create indexes (run once)
// await db.createIndexes();
```

### Supabase

```javascript
// Reads SUPABASE_URL, SUPABASE_SERVICE_KEY from env if no options passed
const db = adapters.supabaseAdapter();

// Create table: run db.getCreateTableSQL() in Supabase SQL editor
```

### Firebase (Firestore)

```javascript
// Reads GOOGLE_APPLICATION_CREDENTIALS, GCLOUD_PROJECT from env if no options passed
const db = adapters.firebaseAdapter();
```

### Adapter Interface

All adapters provide:

| Method | Description |
|--------|-------------|
| `createAgent({ apiKeyHash, claimToken, verificationCode, name?, description? })` | Insert agent (returns `{ id }`) |
| `findAgentByApiKeyHash(hash)` | Look up by token hash |
| `findAgentByVerificationCode(code)` | Look up for X/Discord verification |
| `findAgentByClaimToken(token)` | Look up for claim URL |
| `updateAgentStatus(id, status)` | Update status to `claimed` |

**Security:** Adapters never receive or store plain API keys. Always pass `utils.hashToken(apiKey)` as `apiKeyHash`.

### Custom Database

Use your own storage by implementing the same interface. See [Storage Best Practices](#storage-best-practices) for hashing and lookup.

## The Connection Flow

When a user tells their bot *"Connect to [YourSite] for X"*, Sesame supports this flow:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User: "Connect to YourSite for posting."                       │
│     Bot visits your auth endpoint or generates a claim code       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Bot calls POST /auth/connect                                  │
│     ← Returns: verification_code (e.g. reef-X4B2), claim_url     │
│     Bot tells user: "Post reef-X4B2 to X/Discord to verify"       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. User verifies                                                 │
│     • Posts code to X/Discord, OR                                 │
│     • Signs a message, OR                                         │
│     • Visits claim_url and completes verification                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Bot receives access token                                     │
│     • Polls GET /auth/status until claimed, OR                     │
│     • Token was returned at step 2 (unlocked after verification)  │
│     Bot stores token, uses it for API calls                       │
└─────────────────────────────────────────────────────────────────┘
```

**Verification options:**
- **Post to X/Discord** — User posts `verification_code` (e.g. `reef-X4B2`). Your app verifies via API or webhook.
- **Sign a message** — User signs a challenge with their wallet; your app verifies the signature.
- **Visit claim_url** — User opens the claim link and completes OAuth or another flow.

## How It Works (Technical)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Bot visits POST /auth/connect                                 │
│     ← Returns: api_key, claim_url, verification_code             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Bot stores API key (e.g. in OpenClaw auth-profiles.json)      │
│     Sends: Authorization: Bearer sesame_xxx... on every request  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Human verifies (post code / sign / visit claim_url)           │
│     Agent status: pending_claim → claimed                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Bot calls your API                                           │
│     GET /api/v1/agents/me                                        │
│     req.agent = { name, status, ... }                            │
└─────────────────────────────────────────────────────────────────┘
```

## OpenClaw / Clawd Integration

Agents authenticate using standard HTTP Bearer tokens. When an OpenClaw or Clawd agent connects:

1. **Connect** — User says "Connect to YourSite for X". Bot visits your auth endpoint.
2. **Claim code** — Your app returns `verification_code` (e.g. `reef-X4B2`) and `claim_url`.
3. **Verify** — User posts the code to X/Discord, signs a message, or visits `claim_url`.
4. **Access** — Bot receives the API key (at connect or after verification). Sends `Authorization: Bearer sesame_xxx...` on every request.

Your app uses Sesame middleware to validate the token and look up the agent.

**Example: Agent making a request**

```bash
curl -H "Authorization: Bearer sesame_a1b2c3d4e5f6..." \
  https://myapp.com/api/v1/agents/me
```

## API Reference

### SesameAuth

Main authentication class.

```javascript
const auth = new SesameAuth(options);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tokenPrefix` | string | `'sesame_'` | Prefix for API keys |
| `claimPrefix` | string | `'sesame_claim_'` | Prefix for claim tokens |
| `tokenLength` | number | `32` | Random bytes (64 hex chars) |
| `claimBaseUrl` | string | `''` | Base URL for claim flow |

#### Methods

| Method | Description |
|--------|-------------|
| `generateApiKey()` | Generate new API key |
| `generateClaimToken()` | Generate claim token for verification |
| `generateVerificationCode()` | Human-readable code (e.g. `reef-X4B2`) |
| `validateApiKey(token)` | Validate API key format |
| `validateClaimToken(token)` | Validate claim token format |
| `validateToken(token)` | Validate either type |
| `extractToken(authHeader)` | Extract from `Authorization` header |
| `compareTokens(a, b)` | Timing-safe comparison |
| `createRegistration(name, desc?)` | Full registration object |

### Middleware

#### authMiddleware(auth, options)

Express middleware for protected routes.

```javascript
// Required auth (401 if missing/invalid)
app.get('/api/v1/agents/me', authMiddleware(auth), handler);

// Optional auth (req.agent may be null)
app.get('/api/v1/posts', authMiddleware(auth, { required: false }), handler);

// Require claimed status (403 if pending_claim)
app.get('/api/v1/premium', requireClaimed(auth), handler);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `required` | boolean | `true` | Return 401 if no valid token |
| `getUserByToken` | function | `null` | Async lookup: `(token) => agent \| null` |
| `onError` | function | `null` | Custom error handler |
| `checkClaimed` | boolean | `false` | Require `status !== 'pending_claim'` |

#### requireClaimed(auth, options)

Convenience wrapper that sets `checkClaimed: true` and `required: true`.

#### optionalAuth(auth, options)

Convenience wrapper that sets `required: false`.

### Utils

```javascript
const { utils } = require('@sesame/auth');

// Hash token for storage (never store plain tokens!)
utils.hashToken(token);           // SHA-256 hex
utils.validateTokenHash(token, hash);

// Safe display
utils.maskToken(token);          // 'sesame_abc1...x789'

// Parse claim URL
utils.parseClaimUrl('https://myapp.com/claim/sesame_claim_abc123');
// → 'sesame_claim_abc123'

// Quick check
utils.looksLikeToken(str);       // true if sesame_ or sesame_claim_

// IDs
utils.shortId(8);                // Random base64url string
utils.randomString(16, 'hex');    // Custom length/charset
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NO_TOKEN` | 401 | No `Authorization` header |
| `INVALID_FORMAT` | 401 | Token format invalid |
| `INVALID_TOKEN` | 401 | Token not found (getUserByToken returned null) |
| `NOT_CLAIMED` | 403 | Agent not yet claimed |

### Custom Error Handler

```javascript
authMiddleware(auth, {
  onError: (res, code, msg) => {
    res.status(msg.status).json({
      error: msg.error,
      code,
      hint: msg.hint
    });
  }
});
```

## Verification Flow (Claim)

The **claim flow** lets a human verify they own an agent before it gets full access.

**Option A: Post code to X/Discord**

1. Bot visits `POST /auth/connect` → receives `verification_code` (e.g. `reef-X4B2`), `api_key`, `claim_url`
2. Bot tells user: "Post `reef-X4B2` to X/Discord to verify"
3. User posts the code
4. Your app verifies (X API, Discord webhook, or manual check)
5. You update agent `status` to `claimed`
6. Bot has `api_key` from step 1; use `requireClaimed` for routes that need verification first

**Option B: Visit claim URL**

1. Bot visits `POST /auth/connect` → receives `claim_url` and `verification_code`
2. Human visits `claim_url` (e.g. `https://myapp.com/claim/sesame_claim_xxx`)
3. Your claim page verifies (OAuth, email, etc.)
4. You update agent `status` to `claimed`

**Option C: Sign a message**

1. Bot visits `POST /auth/connect` → receives a challenge message
2. User signs the message with their wallet
3. Your app verifies the signature
4. You update agent `status` to `claimed`

Use `requireClaimed(auth)` for routes that need verified agents:

```javascript
// Only claimed agents can access
app.get('/api/v1/premium', requireClaimed(auth, { getUserByToken: getAgent }), handler);
```

## Storage Best Practices

**Never store plain API keys.** Hash them before persisting:

```javascript
const { SesameAuth, utils } = require('@sesame/auth');

app.post('/api/v1/agents/register', (req, res) => {
  const reg = auth.createRegistration(req.body.name);
  
  await db.agents.create({
    name: req.body.name,
    apiKeyHash: utils.hashToken(reg.apiKey),  // Store hash only
    claimToken: reg.claimToken,
    verificationCode: reg.verificationCode,
    status: 'pending_claim'
  });
  
  // Return plain key once (user must save it)
  res.json(reg.response);
});

// Lookup: hash incoming token, compare to stored hash
const getAgent = async (token) => {
  const hash = utils.hashToken(token);
  return db.agents.findByApiKeyHash(hash);
};
```

## TypeScript

```typescript
import { SesameAuth, authMiddleware, Agent, AuthenticatedRequest } from '@sesame/auth';

const auth = new SesameAuth();

app.get('/me', authMiddleware(auth), (req: AuthenticatedRequest, res) => {
  const agent: Agent | null = req.agent;
  // ...
});
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `NO_TOKEN` | Ensure agent sends `Authorization: Bearer <key>` header |
| `INVALID_FORMAT` | Token must start with `sesame_` + 64 hex chars |
| `INVALID_TOKEN` | `getUserByToken` returned null — check your lookup logic |
| `NOT_CLAIMED` | Use `authMiddleware` instead of `requireClaimed`, or complete claim flow |
| Agent not found | Verify you're passing `getUserByToken` and it queries the right store |

## Security

**Core:**
- Tokens generated using `crypto.randomBytes()` (CSPRNG)
- Timing-safe comparison prevents timing attacks
- Tokens never logged or exposed in errors
- HTTPS required for all API calls

**Adapters:**
- **No plain keys** — Adapters receive only `apiKeyHash`; plain API keys never touch the database
- **Parameterized queries** — Postgres/Supabase use `$1`, `$2` placeholders; MongoDB uses driver escaping
- **Input validation** — `apiKeyHash` must be 64 hex chars; table/collection names validated (alphanumeric + underscore only)
- **Sanitized responses** — `api_key_hash` stripped from agent objects before returning

## License

MIT
