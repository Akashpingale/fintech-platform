import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { StorageService } from './storage.service';

const THEME_KEY = 'fintech-dark';

/**
 * Light/dark theme, persisted in localStorage.
 *
 * Storage and `matchMedia` are both feature-detected: this service is
 * constructed before the first render and must not throw in an environment
 * without them (unit tests, or server-side rendering).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

  /** false = light, true = dark. */
  readonly isDark = signal<boolean>(this.loadPreference());

  constructor() {
    effect(() => this.applyTheme(this.isDark()));
  }

  toggle(): void {
    this.isDark.update(dark => !dark);
    this.storage.set(THEME_KEY, this.isDark());
  }

  set(dark: boolean): void {
    this.isDark.set(dark);
    this.storage.set(THEME_KEY, dark);
  }

  /** Stored choice if there is one, otherwise the OS preference. */
  private loadPreference(): boolean {
    const stored = this.storage.get<boolean>(THEME_KEY);
    if (typeof stored === 'boolean') return stored;
    return this.prefersDarkOs();
  }

  private prefersDarkOs(): boolean {
    const view = this.document.defaultView;
    if (!view || typeof view.matchMedia !== 'function') return false;
    try {
      return view.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }

  private applyTheme(dark: boolean): void {
    const body = this.document.body;
    if (!body) return;
    body.classList.toggle('dark-theme', dark);
  }
}
