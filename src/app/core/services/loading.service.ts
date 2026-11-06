import { Injectable, signal } from '@angular/core';

/** Global loading state for HTTP operations */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _count = 0;
  isLoading = signal(false);

  show(): void {
    this._count++;
    this.isLoading.set(true);
  }

  hide(): void {
    this._count = Math.max(0, this._count - 1);
    if (this._count === 0) this.isLoading.set(false);
  }
}
