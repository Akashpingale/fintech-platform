/**
 * API configuration.
 *
 * The app talks to a json-server mock backend. Services use root-relative
 * endpoints (e.g. `/transactions`); `apiInterceptor` rewrites them onto
 * `API_BASE_URL` so the services stay transport-agnostic and every request
 * can transparently fall back to localStorage when the mock server is down.
 */
export const API_BASE_URL = 'http://localhost:3000';

/** Collections exposed by db.json — used by the interceptor and backup/restore. */
export const API_COLLECTIONS = [
  'users',
  'transactions',
  'budgets',
  'goals',
  'holdings',
  'assetTransactions',
  'sips',
  'watchlist',
  'notifications',
  'marketPrices',
] as const;

export type ApiCollection = (typeof API_COLLECTIONS)[number];
