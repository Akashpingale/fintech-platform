import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

/**
 * Application configuration.
 *
 * Interceptor order matters: `api` rewrites the URL first, `auth` then attaches
 * the token, `loading` brackets the request for the progress bar, and `error`
 * sits outermost so it sees failures from every stage.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
    provideHttpClient(
      withInterceptors([
        apiInterceptor,
        authInterceptor,
        loadingInterceptor,
        errorInterceptor,
      ])
    ),
    provideAnimationsAsync(),
    // Chart.js controllers, scales and elements. Providing this at the root
    // puts Chart.js in the initial bundle; it cannot be deferred, because
    // importing anything from `ng2-charts` here pulls the library in regardless
    // of where the registerables are registered.
    provideCharts(withDefaultRegisterables()),
  ],
};
