import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/** Maps an HTTP failure to a short, user-facing sentence. */
function describe(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Mock API unreachable — showing locally saved data.';
  }
  switch (error.status) {
    case 400:
      return 'That request was rejected. Please check the values and retry.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return 'We could not find what you were looking for.';
    case 500:
    case 502:
    case 503:
      return 'The mock API had a problem. Please try again.';
    default:
      return `Request failed (${error.status}).`;
  }
}

/**
 * Centralised HTTP error handling.
 *
 * Status 0 (json-server not running) is deliberately quiet: services already
 * recover from it via their localStorage fallback, so a toast on every such
 * request would be noise. The error is still re-thrown so callers can react.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 0) {
        toast.error(describe(error));
      }
      return throwError(() => error);
    })
  );
};
