/**
 * TypeScript definitions for @sesame/auth
 * Sesame - Agent authentication for OpenClaw/Clawd bots
 */

import { Request, Response, NextFunction } from 'express';

export interface SesameAuthOptions {
  tokenPrefix?: string;
  claimPrefix?: string;
  tokenLength?: number;
  claimBaseUrl?: string;
}

export interface RegistrationResult {
  apiKey: string;
  claimToken: string;
  verificationCode: string;
  response: {
    agent: {
      api_key: string;
      claim_url: string;
      verification_code: string;
    };
    important: string;
  };
}

export interface Agent {
  id?: string;
  name: string;
  displayName?: string;
  description?: string;
  status?: 'pending_claim' | 'claimed' | 'active';
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
  agent: Agent | null;
  token: string | null;
}

export type ErrorCode = 'NO_TOKEN' | 'INVALID_FORMAT' | 'INVALID_TOKEN' | 'NOT_CLAIMED';

export interface ErrorMessage {
  status: number;
  error: string;
  hint: string;
}

export interface AuthMiddlewareOptions {
  required?: boolean;
  getUserByToken?: (token: string) => Agent | null | Promise<Agent | null>;
  onError?: (res: Response, code: ErrorCode, message: ErrorMessage) => void;
  checkClaimed?: boolean;
}

export class SesameAuth {
  constructor(options?: SesameAuthOptions);

  readonly tokenPrefix: string;
  readonly claimPrefix: string;
  readonly tokenLength: number;
  readonly claimBaseUrl: string;

  generateApiKey(): string;
  generateClaimToken(): string;
  generateVerificationCode(): string;
  validateApiKey(token: string): boolean;
  validateClaimToken(token: string): boolean;
  validateToken(token: string): boolean;
  extractToken(authHeader: string | undefined): string | null;
  compareTokens(tokenA: string, tokenB: string): boolean;
  createRegistration(name: string, description?: string): RegistrationResult;
}

export function authMiddleware(
  auth: SesameAuth,
  options?: AuthMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => void;

export function requireClaimed(
  auth: SesameAuth,
  options?: Omit<AuthMiddlewareOptions, 'required' | 'checkClaimed'>
): (req: Request, res: Response, next: NextFunction) => void;

export function optionalAuth(
  auth: SesameAuth,
  options?: Omit<AuthMiddlewareOptions, 'required'>
): (req: Request, res: Response, next: NextFunction) => void;

export function sanitizeAgent(agent: Agent): Omit<Agent, 'apiKey' | 'api_key' | 'claimToken' | 'claim_token'>;

export const ErrorCodes: {
  NO_TOKEN: 'NO_TOKEN';
  INVALID_FORMAT: 'INVALID_FORMAT';
  INVALID_TOKEN: 'INVALID_TOKEN';
  NOT_CLAIMED: 'NOT_CLAIMED';
};

export const ErrorMessages: Record<ErrorCode, ErrorMessage>;

export namespace utils {
  function randomString(length: number, charset?: string): string;
  function hashToken(token: string): string;
  function validateTokenHash(token: string, hash: string): boolean;
  function maskToken(token: string): string;
  function looksLikeToken(str: string): boolean;
  function parseClaimUrl(url: string): string | null;
  function shortId(length?: number): string;
}

// Convenience exports from default instance
export function generateApiKey(): string;
export function generateClaimToken(): string;
export function generateVerificationCode(): string;
export function validateApiKey(token: string): boolean;
export function validateClaimToken(token: string): boolean;
export function validateToken(token: string): boolean;
export function extractToken(header: string | undefined): string | null;
export function compareTokens(tokenA: string, tokenB: string): boolean;

export const default: SesameAuth;

// Database adapters
export namespace adapters {
  function createAdapter(type: 'postgres' | 'mongodb' | 'firebase' | 'supabase', options?: object): Adapter;
  function createGetUserByToken(adapter: Adapter, utils: typeof import('./utils')): (token: string) => Promise<Agent | null>;

  function postgresAdapter(options: { connectionString?: string; pool?: object; table?: string }): Adapter;
  function mongodbAdapter(options: { connectionString?: string; database?: string; collection?: string; client?: object }): Adapter;
  function firebaseAdapter(options: { credential?: object; projectId?: string; collection?: string; app?: object }): Adapter;
  function supabaseAdapter(options: { url: string; serviceKey: string; table?: string; client?: object }): Adapter;
}

export interface Adapter {
  createAgent(data: { apiKeyHash: string; claimToken: string; verificationCode: string; name?: string; description?: string }): Promise<{ id: string }>;
  findAgentByApiKeyHash(hash: string): Promise<Agent | null>;
  findAgentByVerificationCode(code: string): Promise<Agent | null>;
  findAgentByClaimToken(token: string): Promise<Agent | null>;
  updateAgentStatus(id: string, status: string): Promise<void>;
}
