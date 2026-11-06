import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

export const TOKEN_KEY = 'fintech-token';
export const SESSION_USER_KEY = 'fintech-user';

/** Decoded payload of our mock JWT. */
export interface MockTokenPayload {
  sub: string;
  email: string;
  name: string;
  /** Expiry as a unix timestamp in seconds. */
  exp: number;
}

/**
 * Low-level token persistence and parsing.
 *
 * Split out from AuthService so `authInterceptor` can read the token without
 * creating a circular dependency (AuthService itself uses HttpClient).
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly storage = inject(StorageService);

  read(): string | null {
    return this.storage.get<string>(TOKEN_KEY);
  }

  write(token: string): void {
    this.storage.set(TOKEN_KEY, token);
  }

  clear(): void {
    this.storage.remove(TOKEN_KEY);
    this.storage.remove(SESSION_USER_KEY);
  }

  /**
   * Signs a mock JWT. This is a demo artefact: the "signature" is a constant,
   * because there is no backend to verify it. Never use this pattern against a
   * real API — tokens must be issued and signed server-side.
   */
  sign(payload: Omit<MockTokenPayload, 'exp'>, ttlHours = 12): string {
    const body: MockTokenPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
    };
    const header = this.toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const claims = this.toBase64Url(JSON.stringify(body));
    return `${header}.${claims}.mock-signature`;
  }

  /** Returns the payload, or null when the token is missing/malformed. */
  decode(token = this.read()): MockTokenPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as MockTokenPayload;
    } catch {
      return null;
    }
  }

  /** True when a token exists and has not expired. */
  isValid(): boolean {
    const payload = this.decode();
    if (!payload) return false;
    return payload.exp * 1000 > Date.now();
  }

  private toBase64Url(value: string): string {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
