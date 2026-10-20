# תקיפה ג׳ — manpower app

Mobile web app (PWA) for a reserve company's daily manpower picture: who is on base today, team cards,
status changes written straight into the company's Google Sheet, vehicle assignments (שבצ"ק),
attached soldiers, 7-day alerts, שמ"פ changes, company summary and ready-to-send WhatsApp reports.

**The Google Sheet is the single source of truth.** The app has no database: it reads the sheet
through a Google service account and writes single cells back (a daily status, a vehicle, the hidden
`_app` settings tab). Changes made in the sheet appear in the app within ~20 seconds.

## Access
- Sign in with Google (only name + email are requested).
- **Anyone the spreadsheet is shared with (any role) can use the app.** The server checks the sheet's
  sharing list on every request (cached for 5 minutes).
- **Add a commander:** share the sheet with their Google account. **Remove:** unshare it.
- Optional extra emails: `EXTRA_ALLOWED_EMAILS` in Vercel (comma separated).
- The sensitive `DATA תקיפה ג` tab: only the personal-number and main-role columns are ever read.

## Stack
Next.js 15 (App Router, TypeScript) on Vercel · Auth.js v5 (Google) · Google Sheets + Drive APIs via a
service account · PWA (manifest, icons, app-shell service worker). See `DECISIONS.md` for the details
and the reasoning behind them.

## Development
```bash
pnpm install
pnpm dev:mock        # synthetic fixture, fake user, http://localhost:3000
pnpm dev             # real sheet; needs .env.local (see .env.example)
pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm e2e   # parity with the original artifact (needs reference/), UI at 375 px, PWA checks
```

Layout: `lib/sheet` (parsing, cell location), `lib/core` (calculations, WhatsApp texts),
`lib/server` (Google access, auth guard), `components` (views), `app/api` (`data`, `version`,
`changes`, `health`), `tests` (vitest), `e2e` (Playwright), `scripts` (one-time setup).

Tests use only invented names and numbers (`lib/mock/fixture.ts`). Never commit real data.
