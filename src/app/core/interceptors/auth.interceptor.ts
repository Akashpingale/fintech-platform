import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStore } from '../services/token.store';

/**
 * Attaches the (mock) JWT to every outgoing request to our own API.
 * json-server ignores the header, but the flow mirrors a real backend.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStore).read();
  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};
