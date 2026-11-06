import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL, API_COLLECTIONS } from '../config/api.config';

/**
 * Rewrites root-relative collection URLs (`/transactions`, `/holdings/h1`, ...)
 * onto the json-server base URL. Anything already absolute, or not a known
 * collection, is passed through untouched (e.g. the CoinGecko crypto API).
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/')) return next(req);

  const segment = req.url.split('/').filter(Boolean)[0] ?? '';
  const isCollection = (API_COLLECTIONS as readonly string[]).includes(segment);
  if (!isCollection) return next(req);

  return next(req.clone({ url: `${API_BASE_URL}${req.url}` }));
};
