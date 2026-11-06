import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';
import { TokenStore } from '../services/token.store';

/** Minimal snapshot carrying only the `url` the guard reads. */
function stateFor(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

describe('route guards', () => {
  let auth: AuthService;
  let tokens: TokenStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStore);
    router = TestBed.inject(Router);
    auth.logout();
  });

  function signIn(): void {
    tokens.write(
      tokens.sign({ sub: 'u1', email: 'demo@fintrack.in', name: 'Demo User' })
    );
    auth.currentUser.set({
      id: 'u1',
      name: 'Demo User',
      email: 'demo@fintrack.in',
      currency: 'INR',
      monthlyIncome: 50000,
      riskProfile: 'moderate',
    });
  }

  describe('authGuard', () => {
    it('allows a signed-in user through', () => {
      signIn();
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, stateFor('/dashboard'))
      );
      expect(result).toBe(true);
    });

    it('redirects an anonymous visitor to login', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, stateFor('/portfolio'))
      );
      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toContain('/auth/login');
    });

    it('preserves the intended destination as a redirect param', () => {
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, stateFor('/portfolio/h1'))
      );
      expect(router.serializeUrl(result as UrlTree)).toContain(
        'redirect=%2Fportfolio%2Fh1'
      );
    });

    it('rejects a user whose token has expired', () => {
      signIn();
      // Issue a token that expired an hour ago.
      tokens.write(
        tokens.sign(
          { sub: 'u1', email: 'demo@fintrack.in', name: 'Demo User' },
          -1
        )
      );
      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as never, stateFor('/dashboard'))
      );
      expect(result).toBeInstanceOf(UrlTree);
    });
  });

  describe('guestGuard', () => {
    it('allows an anonymous visitor to reach the login page', () => {
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as never, stateFor('/auth/login'))
      );
      expect(result).toBe(true);
    });

    it('sends a signed-in user to the dashboard', () => {
      signIn();
      const result = TestBed.runInInjectionContext(() =>
        guestGuard({} as never, stateFor('/auth/login'))
      );
      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/dashboard');
    });
  });
});
