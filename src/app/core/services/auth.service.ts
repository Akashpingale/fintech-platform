import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { StorageService } from './storage.service';
import { SESSION_USER_KEY, TokenStore } from './token.store';

/** Fields collected by the registration form. */
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  monthlyIncome: number;
  riskProfile: User['riskProfile'];
}

/** A user without the password field — what the app holds in memory. */
export type PublicUser = Omit<User, 'password'>;

/** Credentials seeded in db.json, surfaced on the login screen for the demo. */
export const DEMO_CREDENTIALS = {
  email: 'akash@fintrack.in',
  password: 'Demo@1234',
} as const;

/**
 * Mock authentication against the json-server `/users` collection.
 *
 * This is a frontend-only demo: passwords are compared in the browser and the
 * JWT is self-issued (see TokenStore.sign). A production app must authenticate
 * server-side and never ship password material to the client.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly tokens = inject(TokenStore);

  private readonly endpoint = '/users';
  private readonly localUsersKey = 'users';

  /** The signed-in user, or null. */
  readonly currentUser = signal<PublicUser | null>(this.restoreSession());

  readonly isAuthenticated = computed(
    () => this.currentUser() !== null && this.tokens.isValid()
  );

  /** `userId` to stamp onto records the user creates. */
  readonly userId = computed(() => this.currentUser()?.id ?? 'u1');

  readonly initials = computed(() => {
    const name = this.currentUser()?.name ?? '';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('') || 'FT'
    );
  });

  /** Verifies credentials and opens a session. */
  login(email: string, password: string): Observable<PublicUser> {
    return this.findByEmail(email).pipe(
      switchMap(user => {
        if (!user || user.password !== password) {
          return throwError(() => new Error('Invalid email or password.'));
        }
        return of(this.openSession(user));
      })
    );
  }

  /** Creates an account (rejecting duplicate emails) and opens a session. */
  register(payload: RegisterPayload): Observable<PublicUser> {
    return this.findByEmail(payload.email).pipe(
      switchMap(existing => {
        if (existing) {
          return throwError(
            () => new Error('An account with that email already exists.')
          );
        }
        const draft: Omit<User, 'id'> = {
          name: payload.name,
          email: payload.email.toLowerCase(),
          password: payload.password,
          currency: 'INR',
          monthlyIncome: payload.monthlyIncome,
          riskProfile: payload.riskProfile,
          avatar: '',
        };
        return this.http.post<User>(this.endpoint, draft).pipe(
          catchError(() => {
            const created: User = { ...draft, id: crypto.randomUUID() };
            const local = this.storage.get<User[]>(this.localUsersKey) ?? [];
            this.storage.set(this.localUsersKey, [...local, created]);
            return of(created);
          }),
          map(user => this.openSession(user))
        );
      })
    );
  }

  /** Clears the session. */
  logout(): void {
    this.tokens.clear();
    this.currentUser.set(null);
  }

  /** Persists profile edits (name, currency, income, risk profile, avatar). */
  updateProfile(changes: Partial<PublicUser>): Observable<PublicUser> {
    const current = this.currentUser();
    if (!current) return throwError(() => new Error('Not signed in.'));

    const merged: PublicUser = { ...current, ...changes, id: current.id };
    return this.http.patch<User>(`${this.endpoint}/${current.id}`, changes).pipe(
      catchError(() => of(merged as User)),
      map(() => {
        this.currentUser.set(merged);
        this.storage.set(SESSION_USER_KEY, merged);
        return merged;
      })
    );
  }

  /** Changes the password after re-checking the current one. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    const current = this.currentUser();
    if (!current) return throwError(() => new Error('Not signed in.'));

    return this.findByEmail(current.email).pipe(
      switchMap(user => {
        if (!user || user.password !== currentPassword) {
          return throwError(() => new Error('Current password is incorrect.'));
        }
        return this.http
          .patch<User>(`${this.endpoint}/${user.id}`, { password: newPassword })
          .pipe(
            catchError(() => {
              const local = this.storage.get<User[]>(this.localUsersKey) ?? [];
              const next = local.map(u =>
                u.id === user.id ? { ...u, password: newPassword } : u
              );
              this.storage.set(this.localUsersKey, next);
              return of(user);
            }),
            map(() => undefined)
          );
      })
    );
  }

  /** Looks a user up by email, falling back to locally registered accounts. */
  private findByEmail(email: string): Observable<User | null> {
    const needle = email.trim().toLowerCase();
    return this.http.get<User[]>(this.endpoint).pipe(
      catchError(() => of(this.storage.get<User[]>(this.localUsersKey) ?? [])),
      map(users => {
        const fromServer = users.find(u => u.email.toLowerCase() === needle);
        if (fromServer) return fromServer;
        const local = this.storage.get<User[]>(this.localUsersKey) ?? [];
        return local.find(u => u.email.toLowerCase() === needle) ?? null;
      })
    );
  }

  /** Issues a token, stores the session and returns the password-free user. */
  private openSession(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    this.tokens.write(
      this.tokens.sign({ sub: user.id, email: user.email, name: user.name })
    );
    this.storage.set(SESSION_USER_KEY, publicUser);
    this.currentUser.set(publicUser);
    return publicUser;
  }

  /** Rehydrates a session on page load, discarding it if the token expired. */
  private restoreSession(): PublicUser | null {
    if (!this.tokens.isValid()) {
      this.tokens.clear();
      return null;
    }
    return this.storage.get<PublicUser>(SESSION_USER_KEY);
  }
}
