# FinTrack — Personal Finance & Investment Portfolio Platform

A frontend-only Angular application that brings income, expenses, budgets,
savings goals and investments into one dashboard. Built to
`FINTECH_ANGULAR_IMPLEMENTATION_PLAN.md` (Group 11, HCL Tech Career Shaper
Program — Frontend Development Using Angular).

Angular 21 · standalone components · signals · strict TypeScript · Angular
Material · Chart.js · json-server mock API · currency in ₹ (INR).

---

## Quick start

```bash
npm install
npm run dev          # starts the mock API (:3000) and the app (:4200) together
```

Then open <http://localhost:4200> and sign in with the demo account:

| Email | Password |
|---|---|
| `akash@fintrack.in` | `Demo@1234` |

The login screen has a **Fill demo credentials** button, so nothing needs typing.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Mock API and dev server together (cross-platform) |
| `npm start` | Dev server only, opens a browser |
| `npm run mock-api` | json-server on port 3000 only |
| `npm run seed` | Regenerates `db.json` with demo data dated to the current month |
| `npm test` | Unit tests (Vitest) |
| `npm run build:prod` | Production build into `dist/` |

`npm run seed` matters: all demo data is generated **relative to today**, so the
dashboard, budgets and analytics always have data in their "this month"
windows, however long after cloning you run it.

---

## What is implemented

Every feature in Section 3 of the plan (3.1–3.12).

### Authentication and user management
Register and login with reactive-form validation, a password-strength
checklist, mock JWT in `localStorage` with an expiry check, `authGuard` and
`guestGuard`, a token interceptor, profile editing and change-password.

### Dashboard
Net-worth hero card with a count-up animation, four summary cards with
month-over-month deltas, income-vs-expense bar chart, expense doughnut,
net-worth trend line, budget alerts, goal progress rings and recent activity.

### Income and expense tracker
Full CRUD, search, type/category/date-range filters, sortable and paginated
table, row selection with bulk delete, tags, recurring transactions, and CSV
import and export.

### Budgets
Per-category monthly limits with animated green/amber/red progress bars, alerts
at 80% and 100%, a budget-vs-actual chart, a month picker and "copy last month".

### Savings goals
SVG progress rings, deadline countdown, the monthly contribution needed,
on-track/behind/achieved status, add-and-withdraw money, and a confetti
animation when a goal completes.

### Investment portfolio
Six asset types (stocks, mutual funds, crypto, FDs, gold, bonds). Buy, buy-more
with weighted-average cost, partial and full sell with realised P/L, a per-asset
buy/sell ledger, simulated live prices with green/red tick flashes, allocation
donut, performance line with 1W/1M/6M/1Y/All tabs, top gainers and losers,
**XIRR** and **CAGR**, a risk score, a diversification score, and rebalancing
suggestions against the target mix for the user's risk profile.

### Watchlist
Watched symbols with live quotes, above/below price alerts that raise
notifications when crossed, and a link through to a holding you already own.

### SIP tracker
Plans with instalment progress, next-due reminders, projected maturity value and
an invested-versus-expected-value chart.

### Calculators
SIP, lumpsum/compound interest, EMI (with a full amortisation schedule,
by-year or by-month, exportable as CSV), FD and RD, retirement planner, and an
old-versus-new-regime income tax estimator. All live: results and charts update
as you drag the sliders. These pages are public — no account needed.

### Analytics and insights
Monthly and yearly comparisons, savings-rate trend, top spending categories,
generated plain-language insights, and the **financial health score** on a
semi-circular gauge with its weighted breakdown.

### Reports and export
Branded PDF statements (jsPDF + autoTable) and CSV exports for transactions,
the portfolio, budgets and goals, over a selectable period.

### Notifications
In-app notification centre generated from live budget, goal, SIP and price-alert
state, with per-type filters, read/unread handling, and snackbar toasts for
every action.

### Settings and UX
Light/dark theme that persists and follows the OS on first visit, currency
selection (INR/USD/EUR), JSON backup and restore, cache controls, responsive
layout down to 360px, loading skeletons, empty and error states, ARIA labels,
visible focus rings, and `prefers-reduced-motion` support.

---

## Architecture

```
src/app/
├── core/
│   ├── config/          api.config.ts (base URL, collection list)
│   ├── guards/          auth.guard.ts, guest.guard.ts
│   ├── interceptors/    api, auth, error, loading
│   ├── models/          user, transaction, budget, goal, holding, sip, notification
│   └── services/        collection.store.ts (base) + one service per feature
├── shared/
│   ├── components/      stat-card, chart-card, confirm-dialog, empty-state,
│   │                    skeleton, progress-ring, health-gauge, page-header
│   ├── directives/      count-up, autofocus, highlight-negative
│   ├── pipes/           money, moneyCompact, percentChange, timeAgo
│   ├── utils/           finance.utils.ts, calculator.utils.ts, category-icons.ts
│   └── validators/      app.validators.ts
├── layout/              shell, sidebar, toolbar
└── features/            auth, dashboard, transactions, budgets, goals,
                         portfolio, watchlist, sip, calculators, analytics,
                         reports, notifications, settings, not-found
```

### Data access

`CollectionStore<T>` is the single base class behind every collection service.
It holds a signal with the list and applies one consistent policy:

- json-server is the source of truth when it is reachable;
- every successful read or write mirrors the list into `localStorage`;
- when a request fails, the operation is applied to that cached list instead, so
  the app keeps working with the mock API stopped.

That last point is deliberate for an offline-capable demo. A real backend must
not swallow write failures this way.

`apiInterceptor` rewrites root-relative collection paths (`/transactions`) onto
`API_BASE_URL`, so services stay transport-agnostic and the CoinGecko call
passes through untouched.

### State

Service-per-feature holding signals, with `computed()` for every derived figure
(totals, allocation, health score, progress). Components read those signals
directly; no component recomputes business logic.

### Business logic

All formulas live in `shared/utils/finance.utils.ts` and
`shared/utils/calculator.utils.ts` as pure functions — net worth, savings rate,
P/L, return %, CAGR, XIRR, allocation, diversification, rebalancing, budget
usage and adherence, the health score, SIP, EMI, FD, RD and tax. They are
unit-tested directly.

---

## Testing

```bash
npm test                      # 106 tests
npx ng test --coverage        # coverage report
```

**106 tests, all passing.** Coverage across the modules under test is 74%
statements and 79% lines; `finance.utils.ts` is at 95% statements / 99% lines.
This is coverage of the tested modules, not of the whole application — the
feature components are verified by the end-to-end script below rather than by
component specs.

| Spec | Covers |
|---|---|
| `finance.utils.spec.ts` | Cash flow, P/L, CAGR, XIRR, allocation, diversification, rebalancing, budget adherence, health score, date grouping |
| `calculator.utils.spec.ts` | SIP, lumpsum, EMI and amortisation, FD, RD, tax slabs and regime comparison |
| `app.validators.spec.ts` | Password strength, positive/non-negative numbers, date rules, field matching, error messages |
| `transaction.service.spec.ts` | `HttpTestingController`: load, localStorage fallback, create, delete, sorting, filtering, CSV, recurring generation |
| `guards.spec.ts` | `authGuard` and `guestGuard` redirect logic, including an expired token |
| `api.interceptor.spec.ts` | URL rewriting, and leaving third-party URLs alone |

### End-to-end smoke check

```bash
npm run dev                   # in one terminal
node scripts/verify.mjs       # in another
```

Drives real Chrome through the app: guard redirect, sign-in, all 19 routes
(checking rendered content and console errors), chart rendering, theme toggle,
mobile layout, create/persist/delete a transaction against json-server, add a
watchlist symbol, budget progress, and live price ticking. **30/30 checks pass.**

```bash
node scripts/screenshots.mjs  # writes screenshots/ in light and dark themes
```

---

## Design system

Section 16 of the plan, implemented in `src/styles.scss` (tokens, Material
theme, base styles) and `src/styles/_components.scss` (reusable classes). Every
colour, spacing, radius, shadow and motion value is a CSS custom property, and
dark mode is a single `body.dark-theme` block that re-points the same variables.
Charts read those variables at draw time, so they re-theme with the app.

Gains are green with ▲ and losses red with ▼ — never colour alone. Amounts are
right-aligned with `tabular-nums` and `en-IN` grouping.

---

## Notes and known limits

Things worth knowing before reading the code or demoing it:

- **Authentication is mock.** Passwords are compared in the browser and the JWT
  is self-issued in `TokenStore.sign`. This is unavoidable without a backend and
  must never be copied into a real application.
- **Prices are simulated.** Equity and fund prices follow a bounded random walk
  on an RxJS interval, because there is no key-less intraday API for Indian
  equities. Crypto prices come from CoinGecko's public endpoint when reachable,
  and fall back to simulation when it is not.
- **The portfolio performance chart is a cost-basis timeline**, not a historical
  NAV series. The mock data holds no price history, so the chart reconstructs
  value from buy dates plus the accrued gain. It is labelled as such in the UI.
- **PDF exports print `Rs.` rather than `₹`.** jsPDF's built-in Helvetica has no
  rupee glyph; embedding a Unicode font would add roughly 400 kB for one
  character. CSV exports use plain numbers.
- **Currency switching changes formatting only.** Amounts are not converted,
  because there is no exchange-rate feed. The Settings page says so.
- **Backup restore is local.** It replaces the in-memory stores and their cache,
  but does not write back into `db.json`, so a hard reload re-reads the seed.
- **The initial bundle is 962 kB raw / 248 kB transferred.** The plan's 500 kB
  budget is not reachable with Angular Material plus Chart.js: `provideCharts`
  must run at the root, which pulls Chart.js (~206 kB) into the initial bundle.
  jsPDF *is* lazy — it loads only when a PDF is generated. Budgets in
  `angular.json` are set to the measured figures so a real regression still
  fails the build.
- **`ng2-charts` is pinned to v10.** v11 requires Angular 22; v10 is the release
  that supports Angular 21.

---

## Deployment

```bash
npm run build:prod     # output in dist/fintech-platform/browser
```

The build is warning-free. Deploy the `browser` folder to Firebase Hosting,
Netlify or GitHub Pages with a SPA rewrite to `index.html`.

The deployed app needs a reachable mock API for live data. Without one it falls
back to `localStorage`, so a fresh visitor sees empty states. For a hosted demo,
either deploy json-server somewhere and change `API_BASE_URL` in
`src/app/core/config/api.config.ts`, or seed `localStorage` from a backup file
through Settings → Restore.

---

## Team

| Member | Responsibility |
|---|---|
| Jay Rajendra Ushir | Project setup, layout shell, auth, guards/interceptors, deployment |
| Tejas Narayan Satpute | Transactions, budgets, CSV/PDF export |
| Aditya Mahendra Pardeshi | Investment portfolio, market price service, watchlist |
| Vaishnav Adinath Tanpure | Dashboard, charts, analytics, financial health score |
| Akash Vilas Pingale | Calculators, goals, SIP tracker, notifications, testing and docs |
