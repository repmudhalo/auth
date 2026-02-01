/**
 * Firebase (Firestore) adapter for @sesame/auth
 * Requires: npm install firebase-admin
 *
 * @module @sesame/auth/adapters/firebase
 */

const { validateAgentData, sanitizeAgentForResponse } = require('./base');

const DEFAULT_COLLECTION = 'sesame_agents';

/**
 * Create Firebase adapter
 *
 * @param {Object} options - Configuration (or use env vars)
 * @param {Object} [options.credential] - Firebase admin credential
 * @param {string} [options.projectId] - Firebase project ID
 * @param {string} [options.collection] - Collection name (default: sesame_agents)
 * @param {Object} [options.app] - Existing Firebase Admin app instance
 * @returns {Object} Adapter with createAgent, findAgentByApiKeyHash, etc.
 *
 * Env vars (fallback when options not provided):
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON (Firebase uses this)
 *   GCLOUD_PROJECT, FIREBASE_PROJECT_ID, or SESAME_FIREBASE_PROJECT_ID
 *   SESAME_FIREBASE_COLLECTION (optional)
 */
function firebaseAdapter(options = {}) {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    throw new Error('Install firebase-admin to use Firebase adapter: npm install firebase-admin');
  }

  const collectionName = options.collection ||
    process.env.SESAME_FIREBASE_COLLECTION ||
    DEFAULT_COLLECTION;
  let db;

  function getDb() {
    if (db) return db;
    if (options.app) {
      db = options.app.firestore();
    } else {
      const initOpts = {};
      if (options.credential) {
        initOpts.credential = options.credential;
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initOpts.credential = admin.credential.applicationDefault();
      }
      const projectId = options.projectId ||
        process.env.GCLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.SESAME_FIREBASE_PROJECT_ID;
      if (projectId) initOpts.projectId = projectId;
      const app = admin.apps[0] || admin.initializeApp(Object.keys(initOpts).length ? initOpts : undefined);
      db = admin.firestore();
    }
    return db;
  }

  const col = () => getDb().collection(collectionName);

  return {
    async createAgent(data) {
      validateAgentData(data);
      const doc = {
        api_key_hash: data.apiKeyHash,
        claim_token: data.claimToken,
        verification_code: data.verificationCode,
        name: data.name || null,
        description: data.description || null,
        status: 'pending_claim',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      const ref = await col().add(doc);
      return { id: ref.id };
    },

    async findAgentByApiKeyHash(hash) {
      if (!hash || typeof hash !== 'string') return null;
      const snapshot = await col().where('api_key_hash', '==', hash).limit(1).get();
      const doc = snapshot.docs[0];
      if (!doc) return null;
      return sanitizeAgentForResponse({ id: doc.id, ...doc.data() });
    },

    async findAgentByVerificationCode(code) {
      if (!code || typeof code !== 'string') return null;
      const snapshot = await col().where('verification_code', '==', code).limit(1).get();
      const doc = snapshot.docs[0];
      if (!doc) return null;
      return sanitizeAgentForResponse({ id: doc.id, ...doc.data() });
    },

    async findAgentByClaimToken(token) {
      if (!token || typeof token !== 'string') return null;
      const snapshot = await col().where('claim_token', '==', token).limit(1).get();
      const doc = snapshot.docs[0];
      if (!doc) return null;
      return sanitizeAgentForResponse({ id: doc.id, ...doc.data() });
    },

    async updateAgentStatus(id, status) {
      if (!id || !status) return;
      await col().doc(id).update({
        status,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  };
}

module.exports = firebaseAdapter;
