import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

console.log('[FinTrack] Starting Angular bootstrap...');

bootstrapApplication(App, appConfig)
  .then(() => console.log('[FinTrack] Bootstrap successful!'))
  .catch((err) => {
    console.error('[FinTrack] Bootstrap FAILED:', err);
    document.body.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:red"><h2>App failed to start</h2><pre style="white-space:pre-wrap">${err?.message || err}</pre></div>`;
  });
