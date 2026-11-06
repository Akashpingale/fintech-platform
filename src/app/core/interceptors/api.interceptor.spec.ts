import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { apiInterceptor } from './api.interceptor';
import { API_BASE_URL } from '../config/api.config';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('prefixes a known collection with the mock API base URL', () => {
    http.get('/transactions').subscribe();
    backend.expectOne(`${API_BASE_URL}/transactions`).flush([]);
  });

  it('prefixes a nested collection path', () => {
    http.get('/holdings/h1').subscribe();
    backend.expectOne(`${API_BASE_URL}/holdings/h1`).flush({});
  });

  it('leaves an absolute third-party URL untouched', () => {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin';
    http.get(url).subscribe();
    backend.expectOne(url).flush({});
  });

  it('leaves an unknown root-relative path untouched', () => {
    http.get('/assets/config.json').subscribe();
    backend.expectOne('/assets/config.json').flush({});
  });
});
